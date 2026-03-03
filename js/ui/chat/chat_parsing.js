const chatParsingModule = {
  _parseAIResponse: (textContentString, roleName, roleType, providedParserJsCode = null) => {
    let parserJsCode = providedParserJsCode || '';
    const chatroomDetails = stateModule.currentChatroomDetails;
    let sectionType = (roleType === 'role' || roleType === 'temporary_role') ? 'general' : roleName;
    let useOverrideParser = false;
    if (!parserJsCode && chatroomDetails && chatroomDetails.config && chatroomDetails.config.overrideSettings && chatroomDetails.config.overrideSettings[sectionType]) {
      const overrideSection = chatroomDetails.config.overrideSettings[sectionType];
      if (overrideSection.enabled && overrideSection.responseSchemaParserJs && overrideSection.responseSchemaParserJs.trim() !== '') {
        parserJsCode = overrideSection.responseSchemaParserJs;
        useOverrideParser = true;
      }
    }
    if (!parserJsCode && !useOverrideParser) {
      if (roleType === 'tool' && stateModule.config.toolSettings[roleName]) {
        parserJsCode = stateModule.config.toolSettings[roleName].responseSchemaParserJs || '';
      } else if (roleType === 'role' || roleType === 'temporary_role') {
        parserJsCode = stateModule.config.responseSchemaParserJs || '';
      }
    }
    let parsedResult = null;
    let parserError = null;
    if (typeof textContentString !== 'string' || textContentString.trim() === '') {
      return {
        parsedResult: null,
        parserError: "No valid text content",
        rawText: textContentString
      };
    }
    if (parserJsCode) {
      try {
        const responseJsonMock = {
          candidates: [{
            content: {
              parts: [{
                text: textContentString
              }]
            }
          }]
        };
        const parserFunction = new Function('responseJson', parserJsCode);
        parsedResult = parserFunction(responseJsonMock);
        if (parsedResult && typeof parsedResult === 'object' && parsedResult.error) {
          parserError = parsedResult.error;
          parsedResult = null;
        } else if (parsedResult === null || parsedResult === undefined) {
          parserError = 'Parser returned null/undefined';
          parsedResult = null;
        }
      } catch (e) {
        parserError = `Error executing parser: ${e.message}`;
        parsedResult = null;
      }
    } else {
      parserError = `Parser not defined for ${roleName}`;
      parsedResult = null;
    }
    if (parserError && parsedResult === null && (roleType === 'role' || roleType === 'temporary_role') && roleName !== 'gameHost') {
      parsedResult = {
        processedTurnActions: [{
          type: 'speech',
          content: textContentString
        }]
      };
      parserError = null;
    }
    return {
      parsedResult,
      parserError,
      rawText: textContentString
    };
  },

  _getSpeechActionTextForHistory: (parsedResult, roleType, roleName, parserError, targetRoleNameForTool = null) => {
    if (parserError && !parsedResult) {
      return `[${roleName} 解析错误: ${parserError}]`;
    }
    if (!parsedResult && !parserError) {
      return "[无法格式化: 无解析结果]";
    }

    if (parsedResult && Array.isArray(parsedResult.processedTurnActions) && parsedResult.processedTurnActions.length > 0) {
      let actionsToSummarize = parsedResult.processedTurnActions;

      if (roleType === 'role' || roleType === 'temporary_role') {
        actionsToSummarize = actionsToSummarize.filter(action => action.isIncluded === true);
      }

      return actionsToSummarize
        .map(action => action.content)
        .filter(c => c)
        .join('\n');
    }


    if (roleType === 'tool') {
      if (roleName === 'statusProcessingSystem') {
        return '';
      } else if (roleName === 'drawingMaster') {
        return "[图片绘制]";
      } else if (roleName === 'novelSummaryMaster') {
        return '';
      } else {
        return `[未知工具: ${roleName}]`;
      }
    } else {
      return "[无文本内容]";
    }
  },
};