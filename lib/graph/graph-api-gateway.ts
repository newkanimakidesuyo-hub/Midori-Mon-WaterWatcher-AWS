import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';

/**
 * Grafana SimpleJSON datasourceプラグイン向けのAPI Gateway。旧手動構築のAPI Gateway
 * （Midori-Mon-WaterWatcher-Grafana-Graph, ID: 38cssxdcdk、削除済み）から移行済みで、
 * 現在はこちらが本番として稼働している。
 *
 * ルート構成（GET /, POST /search, POST /query/{proxy+}）とAPIキー要否は移行元と同一。
 */
export function createGraphApiGateway(stack: cdk.Stack, grafanaGraphFn: lambdaNodejs.NodejsFunction) {
  const api = new apigateway.RestApi(stack, 'WaterWatcherGrafanaGraphCdkApi', {
    restApiName: 'Midori-Mon-WaterWatcher-Grafana-Graph-cdk',
    description: 'Grafana SimpleJSON datasource API Gateway for Midori-Mon-WaterWatcher',
    deployOptions: {
      stageName: 'Midori-Mon-WaterWatcher-Grafana-Graph-cdk-Stage',
    },
    apiKeySourceType: apigateway.ApiKeySourceType.HEADER,
  });

  const integration = new apigateway.LambdaIntegration(grafanaGraphFn);

  // GET / と POST /search はAPIキー必須（移行元と同一の構成）
  api.root.addMethod('GET', integration, { apiKeyRequired: true });

  const search = api.root.addResource('search');
  search.addMethod('POST', integration, { apiKeyRequired: true });

  // POST /query/{proxy+} はAPIキー不要。CORSプリフライト(OPTIONS)も移行元同様に用意する
  const query = api.root.addResource('query');
  const queryProxy = query.addResource('{proxy+}');
  queryProxy.addMethod('POST', integration, { apiKeyRequired: false });
  queryProxy.addCorsPreflight({
    allowOrigins: ['*'],
    allowMethods: ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Amz-Date', 'X-Api-Key', 'X-Amz-Security-Token'],
  });

  // 移行時にCDKが新規発行したAPIキー（旧APIキーの値は引き継いでいない）
  const apiKey = api.addApiKey('WaterWatcherGrafanaGraphCdkApiKey', {
    apiKeyName: 'Midori-Mon-WaterWatcher-Grafana-Graph-cdk-Key',
  });

  const usagePlan = api.addUsagePlan('WaterWatcherGrafanaGraphCdkUsagePlan', {
    name: 'Midori-Mon-WaterWatcher-Grafana-Graph-cdk-Plan',
    throttle: { burstLimit: 10, rateLimit: 5 },
    quota: { limit: 1000, period: apigateway.Period.DAY },
  });
  usagePlan.addApiStage({ stage: api.deploymentStage });
  usagePlan.addApiKey(apiKey);

  new cdk.CfnOutput(stack, 'WaterWatcherGrafanaGraphCdkApiUrl', { value: api.url });
  new cdk.CfnOutput(stack, 'WaterWatcherGrafanaGraphCdkApiKeyId', { value: apiKey.keyId });

  return { api, apiKey, usagePlan };
}
