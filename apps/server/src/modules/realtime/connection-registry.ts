type Sender = { send: (message: string) => void };

export class ConnectionRegistry {
  private readonly agents = new Map<string, Sender>();
  private readonly viewersBySession = new Map<string, Set<Sender>>();
  private readonly viewersByDevice = new Map<string, Set<Sender>>();

  addAgent(deviceId: string, sender: Sender) {
    this.agents.set(deviceId, sender);
  }

  removeAgent(deviceId: string) {
    this.agents.delete(deviceId);
  }

  addViewer(sessionId: string, sender: Sender) {
    const viewers = this.viewersBySession.get(sessionId) ?? new Set<Sender>();
    viewers.add(sender);
    this.viewersBySession.set(sessionId, viewers);
  }

  removeViewer(sessionId: string, sender: Sender) {
    const viewers = this.viewersBySession.get(sessionId);
    if (!viewers) return;
    viewers.delete(sender);
    if (viewers.size === 0) this.viewersBySession.delete(sessionId);
  }

  addDeviceViewer(deviceId: string, sender: Sender) {
    const viewers = this.viewersByDevice.get(deviceId) ?? new Set<Sender>();
    viewers.add(sender);
    this.viewersByDevice.set(deviceId, viewers);
  }

  removeDeviceViewer(deviceId: string, sender: Sender) {
    const viewers = this.viewersByDevice.get(deviceId);
    if (!viewers) return;
    viewers.delete(sender);
    if (viewers.size === 0) this.viewersByDevice.delete(deviceId);
  }

  sendToAgent(deviceId: string, payload: unknown) {
    const sender = this.agents.get(deviceId);
    if (!sender) return false;
    sender.send(JSON.stringify(payload));
    return true;
  }

  broadcastToSession(sessionId: string, payload: unknown) {
    const viewers = this.viewersBySession.get(sessionId);
    if (!viewers) return 0;
    const message = JSON.stringify(payload);
    for (const viewer of viewers) viewer.send(message);
    return viewers.size;
  }

  broadcastToDeviceViewers(deviceId: string, payload: unknown) {
    const viewers = this.viewersByDevice.get(deviceId);
    if (!viewers) return 0;
    const message = JSON.stringify(payload);
    for (const viewer of viewers) viewer.send(message);
    return viewers.size;
  }
}
