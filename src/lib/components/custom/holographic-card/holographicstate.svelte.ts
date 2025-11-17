let enabled = $state(true);

export const holographic = {
  get enabled() {
    return enabled;
  },
  toggle: () => {
    enabled = !enabled;
  },
};
