const apiClientNovelaiModule = {
  _prepareNovelAiPayload: async (parsedDrawingMasterData) => {
    if (!parsedDrawingMasterData || typeof parsedDrawingMasterData !== 'object') {
      throw new Error("Invalid Drawing Master data, cannot prepare NAI Payload.");
    }
    const apiSource = stateModule.config.novelaiApiSource || 'official';
    let naiApiKey = stateModule.config.novelaiApiKey;
    let proxyUrl = stateModule.config.novelaiProxyUrl;
    let proxyToken = stateModule.config.novelaiProxyToken;

    if (apiSource === 'official' && !naiApiKey) {
      throw new Error("NovelAI API Key is not set.");
    }
    if (apiSource === 'proxy' && !proxyUrl) {
      throw new Error("NovelAI Proxy URL is not set.");
    }

    let naturalLanguagePrompt = parsedDrawingMasterData.generalTagsString || "";
    const chatroomDetails = stateModule.currentChatroomDetails;

    const templateTags = new Set();
    
    if (chatroomDetails && chatroomDetails.roles) {
        chatroomDetails.roles.forEach(roleData => {
            const roleName = roleData.name;
            if (roleName && roleData.drawingTemplate) {
                let templateToUse = roleData.drawingTemplate;
                
                if (/[\u4e00-\u9fa5]/.test(templateToUse)) {
                    const mappings = stateModule.config.novelaiTemplateMappings || [];
                    const foundMapping = mappings.find(m => m.startsWith(templateToUse + '['));
                    if (foundMapping) {
                        const match = foundMapping.match(/^.+?\[(.*?)\]$/);
                        if (match && match[1]) {
                            templateToUse = match[1];
                        }
                    }
                }

                if (naturalLanguagePrompt.includes(roleName)) {
                    templateTags.add(templateToUse);
                    const regex = new RegExp(roleName, 'g');
                    naturalLanguagePrompt = naturalLanguagePrompt.replace(regex, templateToUse);
                }
            }
        });
    }
    
    let promptParts = [];
    if (stateModule.config.novelaiDefaultPositivePrompt) {
        promptParts.push(stateModule.config.novelaiDefaultPositivePrompt);
    }
    if (stateModule.config.novelaiArtistChain) {
        promptParts.push(stateModule.config.novelaiArtistChain);
    }
    promptParts.push(...Array.from(templateTags));
    
    let rawPrompt = promptParts.join(', ');
    if (naturalLanguagePrompt) {
        rawPrompt += (rawPrompt ? ', ' : '') + naturalLanguagePrompt;
    }

    let cleanedPrompt = rawPrompt.replace(/,\s*,/g, ',');
    cleanedPrompt = cleanedPrompt.replace(/,\s*0\s*,/g, ',');
    cleanedPrompt = cleanedPrompt.replace(/^0\s*,/g, '');
    cleanedPrompt = cleanedPrompt.replace(/,\s*0\s*$/g, '');
    cleanedPrompt = cleanedPrompt.replace(/^\s*0\s*$/g, '');
    cleanedPrompt = cleanedPrompt.replace(/,\s*,/g, ',');
    cleanedPrompt = cleanedPrompt.replace(/^,\s*/, '').replace(/,\s*$/, '');
    
    const finalPrompt = cleanedPrompt.trim();

    const finalNegativePrompt = stateModule.config.novelaiDefaultNegativePrompt || "";
    const seed = 0;
    const model = "nai-diffusion-4-5-full";
    const width = 832;
    const height = 1216;
    const steps = 28;
    const scale = parseFloat(stateModule.config.novelaiScale) || 5.0;
    const cfgRescale = parseFloat(stateModule.config.novelaiCfgRescale) || 0.0;
    const sampler = stateModule.config.novelaiSampler || "k_euler";
    const noiseSchedule = stateModule.config.novelaiNoiseSchedule || "native";

    let finalRequestBody;

    if (apiSource === 'official') {
        const finalParameters = {
          width: width,
          height: height,
          scale: scale,
          sampler: sampler,
          steps: steps,
          seed: seed,
          n_samples: 1,
          dynamic_thresholding: false,
          controlnet_strength: 1,
          add_original_image: false,
          cfg_rescale: cfgRescale,
          noise_schedule: noiseSchedule,
          v4_prompt: {
            caption: {
              base_caption: finalPrompt,
              char_captions: []
            },
            use_coords: false,
            use_order: true
          },
          v4_negative_prompt: {
            caption: {
              base_caption: finalNegativePrompt,
              char_captions: []
            }
          }
        };
        finalRequestBody = {
          model: model,
          action: "generate",
          parameters: finalParameters
        };
    } else {
        finalRequestBody = {
            token: proxyToken,
            model: model,
            sampler: sampler,
            noise_schedule: noiseSchedule,
            size: "竖图",
            steps: String(steps),
            scale: String(scale),
            cfg: String(cfgRescale),
            stream: 0,
            nocache: 1,
            tag: finalPrompt,
            negative: finalNegativePrompt,
            addition: {
                imageToImageBase64: null,
                vibeTransferList: [],
                multiRoleList: [],
                characterKeep: null
            }
        };
    }

    stateModule.lastNaiPrompt = finalPrompt;
    if (typeof settingsNovelaiModule !== 'undefined' && settingsNovelaiModule.updateLastNaiPromptDisplay) {
      settingsNovelaiModule.updateLastNaiPromptDisplay(stateModule.lastNaiPrompt);
    }

    return {
      api_source: apiSource,
      nai_api_key: naiApiKey,
      proxy_url: proxyUrl,
      parameters: finalRequestBody,
      originalDrawingMasterData: parsedDrawingMasterData
    };
  },

  addNaiRequestToQueue: (requestData, triggerMessageId, partitionId, sourceMessageIdForImage) => {
    const queueItem = {
      ...requestData,
      triggerMessageId: triggerMessageId,
      partitionId: partitionId,
      sourceMessageIdForImage: sourceMessageIdForImage || triggerMessageId.split('_')[0]
    };
    if (stateModule.naiRequestQueue.length >= 5) {
      stateModule.naiRequestQueue.shift();
    }
    stateModule.naiRequestQueue.push(queueItem);
    if (!stateModule.isNaiProcessing) {
      apiClientNovelaiModule.processNaiQueue();
    }
  },

  processNaiQueue: async () => {
    if (stateModule.isNaiProcessing || stateModule.naiRequestQueue.length === 0) {
      return;
    }
    stateModule.isNaiProcessing = true;
    const requestData = stateModule.naiRequestQueue.shift();
    const {
      api_source,
      nai_api_key,
      proxy_url,
      parameters,
      originalDrawingMasterData,
      triggerMessageId,
      partitionId,
      sourceMessageIdForImage
    } = requestData;

    const effectiveAbortControllerKey = triggerMessageId;
    stateModule.activeRequests.add(effectiveAbortControllerKey);
    if (stateModule.activeRequests.size === 1) {
      partitionRendererModule.showLoadingSpinner();
    }

    const uiAbortController = new AbortController();
    if (effectiveAbortControllerKey) {
      stateModule.pendingRequests.set(effectiveAbortControllerKey, uiAbortController);
    }

    let success = false;
    let responseData = null;
    let lastErrorEncountered = null;

    try {
        if (api_source === 'proxy') {
            try {
                const proxyResponse = await fetch(proxy_url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(parameters),
                    signal: uiAbortController.signal
                });

                if (proxyResponse.ok) {
                    const responseText = await proxyResponse.text();
                    
                    if (responseText.startsWith("data:image")) {
                        responseData = { imageDataUrl: responseText };
                        success = true;
                    } else {
                        try {
                            const jsonResponse = JSON.parse(responseText);
                            if (jsonResponse.status === 'success' && jsonResponse.url) {
                                const urlObj = new URL(proxy_url);
                                const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
                                const fullImageUrl = baseUrl + jsonResponse.url;
                                
                                const imageResponse = await fetch(fullImageUrl, { signal: uiAbortController.signal });
                                if (imageResponse.ok) {
                                    const blob = await imageResponse.blob();
                                    const reader = new FileReader();
                                    responseData = await new Promise((resolve, reject) => {
                                        reader.onloadend = () => resolve({ imageDataUrl: reader.result });
                                        reader.onerror = reject;
                                        reader.readAsDataURL(blob);
                                    });
                                    success = true;
                                } else {
                                    lastErrorEncountered = { code: "IMAGE_DOWNLOAD_FAILED", message: `Failed to download image from ${fullImageUrl}` };
                                }
                            } else {
                                lastErrorEncountered = { code: "INVALID_PROXY_JSON", message: "Proxy JSON response format invalid." };
                            }
                        } catch (e) {
                            lastErrorEncountered = { code: "INVALID_PROXY_RESPONSE", message: `Proxy response not data URI or valid JSON: ${responseText.substring(0, 100)}...` };
                        }
                    }
                } else {
                    lastErrorEncountered = { code: "PROXY_HTTP_ERROR", message: `Proxy HTTP error: ${proxyResponse.status}` };
                }
            } catch (error) {
                if (error.name === 'AbortError') {
                    lastErrorEncountered = { code: "CANCELLED_BY_UI", message: 'Cancelled by UI' };
                } else {
                    lastErrorEncountered = { code: "PROXY_FETCH_ERROR", message: error.message };
                }
            }
        } else {
            for (let attempt = 1; attempt <= 3; attempt++) {
                if (uiAbortController.signal.aborted) {
                  lastErrorEncountered = { code: "CANCELLED_BY_UI", message: 'Cancelled by UI' };
                  break;
                }

                const proxyResponse = await apiServiceModule.performApiCall(
                  '/novelai-proxy',
                  'POST', {
                    api_source,
                    nai_api_key,
                    parameters
                  }, {},
                  uiAbortController.signal
                );

                if (uiAbortController.signal.aborted) {
                  lastErrorEncountered = { code: "CANCELLED_BY_UI", message: 'Cancelled by UI' };
                  break;
                }

                if (proxyResponse.success && proxyResponse.data && proxyResponse.data.imageDataUrl) {
                  responseData = proxyResponse.data;
                  success = true;
                  break;
                } else {
                  lastErrorEncountered = proxyResponse.error || {
                    code: "NOVELAI_INVALID_RESPONSE",
                    message: 'NAI response missing valid imageDataUrl or success:false'
                  };
                  _logAndDisplayError(`NAI Attempt ${attempt}/3 failed: ${lastErrorEncountered.message}`, 'apiClientNovelaiModule.processNaiQueue');
                  if (attempt < 3) {
                    if (typeof partitionRendererModule !== 'undefined' && partitionRendererModule.showRetryIndicator) {
                      partitionRendererModule.showRetryIndicator();
                    }
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                  }
                }
            }
        }

      if (success && responseData) {
        if (typeof messageActionsImplModule !== 'undefined' && messageActionsImplModule.handleNovelAiResponse) {
          messageActionsImplModule.handleNovelAiResponse(partitionId, {
            success: true,
            data: responseData
          }, originalDrawingMasterData, null, sourceMessageIdForImage);
        }
      } else if (lastErrorEncountered) {
        let finalErrorMessage = '';
        if (lastErrorEncountered.code === 'CANCELLED_BY_UI') {
          finalErrorMessage = `NAI request for trigger message ${triggerMessageId} was cancelled by UI.`;
          _logAndDisplayError(finalErrorMessage, 'apiClientNovelaiModule.processNaiQueue');
        } else {
          finalErrorMessage = `NAI request ultimately failed: ${lastErrorEncountered?.message || 'Unknown error'}`;
          _logAndDisplayError(finalErrorMessage, 'apiClientNovelaiModule.processNaiQueue', 'N/A', 'N/A', lastErrorEncountered);
        }
        if (lastErrorEncountered.code !== 'CANCELLED_BY_UI' || (triggerMessageId && partitionId === stateModule.activePartitionId)) {
          if (typeof messageActionsImplModule !== 'undefined' && messageActionsImplModule.handleNovelAiResponse) {
            messageActionsImplModule.handleNovelAiResponse(partitionId, {
              success: false,
              error: lastErrorEncountered
            }, originalDrawingMasterData, null, sourceMessageIdForImage);
          }
        }
      }
    } finally {
      if (effectiveAbortControllerKey) {
        stateModule.pendingRequests.delete(effectiveAbortControllerKey);
        stateModule.activeRequests.delete(effectiveAbortControllerKey);
        if (stateModule.activeRequests.size === 0) {
          partitionRendererModule.hideLoadingSpinner();
        }
      }
      stateModule.isNaiProcessing = false;
      if (stateModule.naiRequestQueue.length > 0) {
        setTimeout(() => apiClientNovelaiModule.processNaiQueue(), 1000);
      }
    }
  }
};