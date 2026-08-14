import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as iot from 'aws-cdk-lib/aws-iot';
import * as lambda from 'aws-cdk-lib/aws-lambda';

const RULE_NAME = 'Midori_Mon_WaterWatcher_Routing_cdk';

// 本番ルール（Midori_Mon_WaterWatcher_Routing）と完全に同一のSQL。
// 切替時にそのまま置き換えられるよう、意図的に本番と揃えている。
const RULE_SQL = `SELECT
  *,
  topic(3) AS thing_name
FROM '$aws/things/+/shadow/update/accepted'
WHERE state.reported.moisture_sensor_unit.result = True
  OR state.reported.battery.result = True`;

/**
 * Notification-cdk 用のIoT Rule（本番 Midori_Mon_WaterWatcher_Routing の並行テスト版）。
 *
 * 本番と同じ実トピック（$aws/things/+/shadow/update/accepted）を購読するため、
 * 有効化すると実デバイスのイベントで本番Lambdaと同時に発火し、
 * 同じDynamoDBテーブルへの二重書き込みやIoT Shadowの `alerted` フラグ競合が起きる。
 * そのため作成時点では `ruleDisabled: true` とし、デフォルトでは無効化しておく。
 * 動作確認時は、個別invokeでのテストを優先し、実トピックでの有効化は
 * 本番切替の直前など影響を許容できるタイミングでのみ行うこと。
 */
export function createDeviceIotRule(stack: cdk.Stack, notificationFn: lambda.IFunction): iot.CfnTopicRule {
  const rule = new iot.CfnTopicRule(stack, 'WaterWatcherNotificationCdkTopicRule', {
    ruleName: RULE_NAME,
    topicRulePayload: {
      sql: RULE_SQL,
      awsIotSqlVersion: '2016-03-23',
      ruleDisabled: true,
      actions: [
        {
          lambda: {
            functionArn: notificationFn.functionArn,
          },
        },
      ],
    },
  });

  const ruleArn = cdk.Arn.format({ service: 'iot', resource: 'rule', resourceName: RULE_NAME }, stack);

  notificationFn.addPermission('AllowIotInvokeNotificationCdk', {
    principal: new iam.ServicePrincipal('iot.amazonaws.com'),
    sourceArn: ruleArn,
  });

  return rule;
}
