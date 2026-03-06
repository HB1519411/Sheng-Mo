const contextUtilsModule = {};

// Expose internal state for debugging console
window.shengmoAPI = {
  getState: () => commonUtilsModule._shengmoDeepCopy(stateModule),
  getActiveChatroomDetails: () => commonUtilsModule._shengmoDeepCopy(stateModule.currentChatroomDetails),
  getActivePartitionId: () => stateModule.activePartitionId,
  getGlobalConfig: () => commonUtilsModule._shengmoDeepCopy(stateModule.config)
};