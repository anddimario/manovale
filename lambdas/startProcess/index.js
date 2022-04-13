"use strict";
const AWS = require('aws-sdk');
const stepfunctions = new AWS.StepFunctions();

exports.handler = async function (event) {
    console.log(event);
    console.log("request:", JSON.stringify(event, undefined, 2));
    const stateMachines = await stepfunctions.listStateMachines().promise();
    console.log("🚀 ~ file: index.js ~ line 10 ~ stateMachines", stateMachines)
    const processMachine = stateMachines.filter(item => item.includes('Process')); 
    console.log("🚀 ~ file: index.js ~ line 12 ~ processMachineArn", processMachineArn)
    const params = {
      stateMachineArn: processMachine.stateMachineArn, /* required */
      input: event.Records[0].dynamodb.OldImage,
    //   name: 'STRING_VALUE',
    //   traceHeader: 'STRING_VALUE'
    };
    await stepfunctions.startExecution(params).promise();
    return;
};
