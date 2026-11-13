import { useEffect, useState } from "react";

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    let offlineTimer: number | null = null;

    const handleOnline = () => {
      if (offlineTimer !== null) {
        window.clearTimeout(offlineTimer);
        offlineTimer = null;
      }
      setIsOnline(true);
    };

    // Debounce brief mobile network switches so the offline notice doesn't flash unnecessarily.
    const handleOffline = () => {
      if (offlineTimer !== null) window.clearTimeout(offlineTimer);
      offlineTimer = window.setTimeout(() => {
        if (!navigator.onLine) {
          setIsOnline(false);
        }
      }, 2500);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      if (offlineTimer !== null) window.clearTimeout(offlineTimer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}
