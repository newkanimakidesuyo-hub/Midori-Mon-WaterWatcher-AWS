import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import { GRAFANA_API_DOMAIN_NAME, DOMAIN_NAME, HOSTED_ZONE_ID } from '../shared/water-watcher-constants';

/**
 * Grafana-Graph API GatewayにカスタムドメインAPI（{@link GRAFANA_API_DOMAIN_NAME}）を割り当てる。
 *
 * 背景: `cdk destroy`→再deployでAPI Gateway自体が作り直しになるとURLが変わってしまうため、
 * 安定したURLとしてカスタムドメインを導入する。ホストゾーン（`midori-mon.link`、CDK未管理・
 * Route53 Registrar経由で取得済み）はfromHostedZoneAttributesで参照する（fromLookupはスタックに
 * env未指定のため使用不可）。
 *
 * API GatewayはREGIONALのため、ACM証明書もAPI Gatewayと同じリージョン（ap-northeast-1）でよい。
 */
export function createGraphCustomDomain(stack: cdk.Stack, api: apigateway.RestApi) {
  const hostedZone = route53.HostedZone.fromHostedZoneAttributes(stack, 'WaterWatcherHostedZoneRef', {
    hostedZoneId: HOSTED_ZONE_ID,
    zoneName: DOMAIN_NAME,
  });

  const certificate = new acm.Certificate(stack, 'WaterWatcherGrafanaGraphCdkCertificate', {
    domainName: GRAFANA_API_DOMAIN_NAME,
    validation: acm.CertificateValidation.fromDns(hostedZone),
  });

  const domainName = new apigateway.DomainName(stack, 'WaterWatcherGrafanaGraphCdkDomainName', {
    domainName: GRAFANA_API_DOMAIN_NAME,
    certificate,
    endpointType: apigateway.EndpointType.REGIONAL,
    securityPolicy: apigateway.SecurityPolicy.TLS_1_2,
  });

  // 既存のパス構成（GET /, POST /search, POST /query/{proxy+}）をそのまま維持するためbasePathは空
  domainName.addBasePathMapping(api);

  new route53.ARecord(stack, 'WaterWatcherGrafanaGraphCdkAliasRecord', {
    zone: hostedZone,
    recordName: GRAFANA_API_DOMAIN_NAME,
    target: route53.RecordTarget.fromAlias(new targets.ApiGatewayDomain(domainName)),
  });

  new cdk.CfnOutput(stack, 'WaterWatcherGrafanaGraphCdkCustomDomainUrl', {
    value: `https://${GRAFANA_API_DOMAIN_NAME}`,
  });

  return { certificate, domainName };
}
