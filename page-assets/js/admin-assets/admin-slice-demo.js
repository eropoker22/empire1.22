(function () {
  "use strict";

  const mount = (mounts = {}) => {
    const contentMount = mounts.contentMount;
    if (contentMount instanceof HTMLElement) {
      contentMount.replaceChildren();
    }

    return {
      unmount() {
        if (contentMount instanceof HTMLElement) {
          contentMount.replaceChildren();
        }
      }
    };
  };

  window.EmpireAdminSliceDemo = {
    mount
  };
})();
