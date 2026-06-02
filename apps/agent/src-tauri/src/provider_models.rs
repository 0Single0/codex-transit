use std::{collections::HashMap, env, fs, path::PathBuf};

use anyhow::{anyhow, Result};
use serde_json::Value;

use crate::protocol::CodexModel;

#[derive(Debug, Clone)]
pub struct ProviderModelsSnapshot {
    pub models: Vec<CodexModel>,
    pub default_model: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone)]
struct ProviderConfig {
    provider: String,
    base_url: String,
    default_model: String,
}

pub async fn fetch_provider_models() -> ProviderModelsSnapshot {
    match fetch_provider_models_inner().await {
        Ok(snapshot) => snapshot,
        Err(error) => ProviderModelsSnapshot {
            models: Vec::new(),
            default_model: resolve_default_model(),
            error: Some(error.to_string()),
        },
    }
}

async fn fetch_provider_models_inner() -> Result<ProviderModelsSnapshot> {
    let config = resolve_codex_provider_config()?;
    let default_model = resolve_default_model().or(Some(config.default_model.clone()));

    match load_models_from_catalog(&config.provider) {
        Ok(models) if !models.is_empty() => {
            return Ok(ProviderModelsSnapshot {
                models,
                default_model,
                error: None,
            });
        }
        Ok(_) => {}
        Err(_) => {}
    }

    let api_key = env::var("OPENAI_API_KEY")
        .or_else(|_| env::var("OPENAI_API_TOKEN"))
        .map_err(|_| anyhow!("OPENAI_API_KEY is not configured"))?;
    let url = format!("{}/models", config.base_url.trim_end_matches('/'));
    let response = reqwest::Client::new()
        .get(url)
        .bearer_auth(api_key)
        .send()
        .await?
        .error_for_status()?;
    let value: Value = response.json().await?;
    let models = normalize_provider_models(&config.provider, &value)?;
    Ok(ProviderModelsSnapshot {
        models,
        default_model,
        error: None,
    })
}

fn load_models_from_catalog(provider: &str) -> Result<Vec<CodexModel>> {
    let codex_home = resolve_codex_home();
    let entries = fs::read_dir(&codex_home)?;
    let mut newest_catalog: Option<PathBuf> = None;

    for entry in entries {
        let path = entry?.path();
        let Some(file_name) = path.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        if !file_name.starts_with("model-catalog.") || !file_name.ends_with(".json") {
            continue;
        }
        newest_catalog = match newest_catalog {
            Some(current) if current.file_name() >= path.file_name() => Some(current),
            _ => Some(path),
        };
    }

    let catalog_path = newest_catalog.ok_or_else(|| anyhow!("model catalog not found"))?;
    let value: Value = serde_json::from_str(&fs::read_to_string(&catalog_path)?)?;
    normalize_catalog_models(provider, &value)
}

fn normalize_catalog_models(provider: &str, payload: &Value) -> Result<Vec<CodexModel>> {
    let Some(items) = payload.get("models").and_then(Value::as_array) else {
        return Err(anyhow!("model catalog payload missing `models` array"));
    };

    let mut dedup = HashMap::<String, CodexModel>::new();
    for item in items {
        let Some(id) = item
            .get("slug")
            .or_else(|| item.get("id"))
            .and_then(Value::as_str)
        else {
            continue;
        };
        let label = item
            .get("display_name")
            .or_else(|| item.get("label"))
            .and_then(Value::as_str)
            .unwrap_or(id);
        let available = item
            .get("visibility")
            .and_then(Value::as_str)
            .map(|value| value != "hidden")
            .unwrap_or(true);
        let owned_by = item
            .get("owned_by")
            .or_else(|| item.get("provider"))
            .and_then(Value::as_str)
            .map(ToString::to_string);

        dedup.entry(id.to_string()).or_insert(CodexModel {
            id: id.to_string(),
            label: label.to_string(),
            provider: provider.to_string(),
            available,
            owned_by,
        });
    }

    let mut models = dedup.into_values().collect::<Vec<_>>();
    models.sort_by(|left, right| left.id.cmp(&right.id));
    Ok(models)
}

fn resolve_codex_provider_config() -> Result<ProviderConfig> {
    let config_path = resolve_codex_home().join("config.toml");
    let content = fs::read_to_string(&config_path)?;
    let default_model = find_toml_value(&content, "model")
        .ok_or_else(|| anyhow!("missing `model` in {}", config_path.display()))?;
    let provider = find_toml_value(&content, "model_provider").unwrap_or_else(|| "openai".to_string());
    let provider_base_url_key = format!("[model_providers.{provider}]");
    let base_url = find_table_value(&content, &provider_base_url_key, "base_url")
        .or_else(|| env::var("OPENAI_BASE_URL").ok())
        .or_else(|| env::var("OPENAI_API_BASE").ok())
        .ok_or_else(|| anyhow!("missing provider base_url for `{provider}`"))?;
    Ok(ProviderConfig {
        provider,
        base_url,
        default_model,
    })
}

fn resolve_codex_home() -> PathBuf {
    env::var_os("CODEX_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            env::var_os("USERPROFILE")
                .map(PathBuf::from)
                .unwrap_or_else(|| PathBuf::from("."))
                .join(".codex")
        })
}

fn find_toml_value(content: &str, key: &str) -> Option<String> {
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('#') || trimmed.starts_with('[') {
            continue;
        }
        if let Some(value) = trimmed.strip_prefix(&format!("{key} = ")) {
            return Some(value.trim_matches('"').trim_matches('\'').to_string());
        }
    }
    None
}

fn find_table_value(content: &str, table: &str, key: &str) -> Option<String> {
    let mut in_table = false;
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('[') {
            in_table = trimmed == table;
            continue;
        }
        if !in_table || trimmed.starts_with('#') {
            continue;
        }
        if let Some(value) = trimmed.strip_prefix(&format!("{key} = ")) {
            return Some(value.trim_matches('"').trim_matches('\'').to_string());
        }
    }
    None
}

fn resolve_default_model() -> Option<String> {
    env::var("CODEX_MODEL")
        .ok()
        .or_else(|| env::var("OPENAI_MODEL").ok())
}

pub fn normalize_provider_models(provider: &str, payload: &Value) -> Result<Vec<CodexModel>> {
    let Some(items) = payload.get("data").and_then(Value::as_array) else {
        return Err(anyhow!("provider models payload missing `data` array"));
    };
    let mut dedup = HashMap::<String, CodexModel>::new();
    for item in items {
        let Some(id) = item.get("id").and_then(Value::as_str) else {
            continue;
        };
        let owned_by = item
            .get("owned_by")
            .and_then(Value::as_str)
            .map(ToString::to_string);
        dedup.entry(id.to_string()).or_insert(CodexModel {
            id: id.to_string(),
            label: id.to_string(),
            provider: provider.to_string(),
            available: true,
            owned_by,
        });
    }
    let mut models = dedup.into_values().collect::<Vec<_>>();
    models.sort_by(|left, right| left.id.cmp(&right.id));
    Ok(models)
}

#[cfg(test)]
mod tests {
    use super::{normalize_catalog_models, normalize_provider_models};

    #[test]
    fn normalizes_openai_style_model_payload() {
        let payload = serde_json::json!({
            "data": [
                { "id": "gpt-5.3-codex", "owned_by": "openai" },
                { "id": "gpt-4.1", "owned_by": "openai" }
            ]
        });

        let models = normalize_provider_models("custom", &payload).unwrap();

        assert_eq!(models[0].id, "gpt-4.1");
        assert!(models[0].available);
        assert_eq!(models[1].id, "gpt-5.3-codex");
    }

    #[test]
    fn normalizes_catalog_payload() {
        let payload = serde_json::json!({
            "models": [
                { "slug": "gpt-5.4", "display_name": "gpt-5.4", "visibility": "list", "provider": "custom" },
                { "slug": "gpt-5.3-codex", "display_name": "gpt-5.3-codex", "visibility": "list", "provider": "custom" }
            ]
        });

        let models = normalize_catalog_models("custom", &payload).unwrap();

        assert_eq!(models.len(), 2);
        assert_eq!(models[0].id, "gpt-5.3-codex");
        assert_eq!(models[0].label, "gpt-5.3-codex");
        assert_eq!(models[1].id, "gpt-5.4");
    }
}
