"use strict";
const AWS = require('aws-sdk');
const converter = AWS.DynamoDB.Converter;
const stepfunctions = new AWS.StepFunctions();

exports.handler = async function (event) {
    console.log("request:", JSON.stringify(event, undefined, 2));
    const stateMachines = (await stepfunctions.listStateMachines().promise()).stateMachines;
    const processMachine = stateMachines.filter(item => item.name.includes('Process')); 
    const params = {
      stateMachineArn: processMachine[0].stateMachineArn, /* required */
      input: JSON.stringify(converter.unmarshall(event.Records[0].dynamodb.OldImage)),
    //   name: 'STRING_VALUE',
    //   traceHeader: 'STRING_VALUE'
    };
    await stepfunctions.startExecution(params).promise();
    return;
};
