window.CloudSyncService = {
  async pushProgress(snapshot) {
    localStorage.setItem("cloud-sync-draft", JSON.stringify({ snapshot, syncedAt: new Date().toISOString() }));
    return { ok: true, mode: "local-placeholder" };
  },
  async pullProgress() {
    const raw = localStorage.getItem("cloud-sync-draft");
    return raw ? JSON.parse(raw).snapshot : null;
  }
};
