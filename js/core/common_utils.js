const commonUtilsModule = {
  _shengmoDeepCopy: (obj) => structuredClone(obj),
  isStandardTimeFormat: (timeString) => /^-?\d{4}-\d{2}-\d{2}$/.test(timeString)
};