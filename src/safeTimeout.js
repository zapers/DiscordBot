/**
 * setTimeout that handles durations longer than 2^31-1 ms (~24.8 days)
 * by chaining smaller timeouts.
 * Returns an object with a .clear() method.
 */
const MAX_TIMEOUT = 2_147_483_647; // 2^31 - 1

export function safeTimeout(callback, delay) {
  let timerId = null;
  let cleared = false;

  function schedule(remaining) {
    if (cleared) return;
    if (remaining <= MAX_TIMEOUT) {
      timerId = setTimeout(() => {
        if (!cleared) callback();
      }, remaining);
    } else {
      timerId = setTimeout(() => {
        if (!cleared) schedule(remaining - MAX_TIMEOUT);
      }, MAX_TIMEOUT);
    }
  }

  schedule(Math.max(0, delay));

  return {
    clear() {
      cleared = true;
      if (timerId !== null) clearTimeout(timerId);
    },
  };
}
