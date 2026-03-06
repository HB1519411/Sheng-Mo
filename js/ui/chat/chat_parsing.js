const chatParsingModule = {
  _parseAIResponse: (textContentString, roleName, roleType, providedParserJsCode = null) => {
    let parserJsCode = providedParserJsCode || '';
    if (!parserJsCode) {
      if (roleType === 'tool' && stateModule.config.toolSettings[roleName]) {
        parserJsCode = stateModule.config.toolSettings[roleName].responseSchemaParserJs || '';
      } else if (roleType === 'role' || roleType === 'temporary_role') {
        parserJsCode = stateModule.config.responseSchemaParserJs || '';
      }
    }
    let parsedResult = null;
    let parserError = null;
    if (!textContentString || typeof textContentString !== 'string' || textContentString.trim() === '') {
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
        if (parsedResult && parsedResult.error) {
          parserError = parsedResult.error;
          parsedResult = null;
        } else if (!parsedResult) {
          parserError = 'Parser returned null/undefined';
        }
      } catch (e) {
        parserError = `Error executing parser: ${e.message}`;
        parsedResult = null;
      }
    } else {
      parserError = `Parser not defined for ${roleName}`;
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
    if (!parsedResult) {
      return "[无法格式化: 无解析结果]";
    }
    if (parsedResult.processedTurnActions?.length > 0) {
      let actionsToSummarize = parsedResult.processedTurnActions;
      if (roleType === 'role' || roleType === 'temporary_role') {
        actionsToSummarize = actionsToSummarize.filter(action => action.isIncluded === true);
      }
      return actionsToSummarize
        .map(action => action.content)
        .filter(Boolean)
        .join('\n');
    }
    return "[无文本内容]";
  },
};