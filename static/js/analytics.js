(() => {
  const sendEvent = (event) => {
    if (!event) return;
    fetch("/api/analytics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event }),
      keepalive: true,
    }).catch(() => {});
  };

  // Privacy-safe analytics: aggregated counters only, no identifiers or storage.
  window.GeoAnalytics = {
    track: sendEvent,
  };

  document.addEventListener("DOMContentLoaded", () => {
    sendEvent("session_started");
  });
})();
