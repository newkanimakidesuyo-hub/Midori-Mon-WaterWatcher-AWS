import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as iot from 'aws-cdk-lib/aws-iot';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';

const RULE_NAME = 'Midori_Mon_WaterWatcher_Routing_cdk';

// 移行元の本番ルール（Midori_Mon_WaterWatcher_Routing、削除済み）と完全に同一のSQL。
const RULE_SQL = `SELECT
  *,
  topic(3) AS thing_name
FROM '$aws/things/+/shadow/update/accepted'
WHERE state.reported.moisture_sensor_unit.result = True
  OR state.reported.battery.result = True`;

/**
 * Notification-cdk 用のIoT Rule。旧手動構築の Midori_Mon_WaterWatcher_Routing から移行済みで、
 * 現在はこちらが本番として稼働している（旧ルールは削除済み）。常に有効。
 */
export function createDeviceIotRule(stack: cdk.Stack, notificationFn: lambda.IFunction): iot.CfnTopicRule {
  // Rule実行が失敗した場合に内容を残すためのエラーログ（デフォルトでは何も残らないため）
  const errorLogGroup = new logs.LogGroup(stack, 'WaterWatcherNotificationCdkTopicRuleErrorLogGroup', {
    logGroupName: `/aws/iot/${RULE_NAME}-errors`,
    retention: logs.RetentionDays.ONE_YEAR,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
  });

  const errorActionRole = new iam.Role(stack, 'WaterWatcherNotificationCdkTopicRuleErrorRole', {
    assumedBy: new iam.ServicePrincipal('iot.amazonaws.com'),
    description: 'Allows the WaterWatcher Notification IoT Rule to write execution errors to CloudWatch Logs',
  });
  errorLogGroup.grantWrite(errorActionRole);

  const rule = new iot.CfnTopicRule(stack, 'WaterWatcherNotificationCdkTopicRule', {
    ruleName: RULE_NAME,
    topicRulePayload: {
      sql: RULE_SQL,
      awsIotSqlVersion: '2016-03-23',
      actions: [
        {
          lambda: {
            functionArn: notificationFn.functionArn,
          },
        },
      ],
      errorAction: {
        cloudwatchLogs: {
          logGroupName: errorLogGroup.logGroupName,
          roleArn: errorActionRole.roleArn,
        },
      },
    },
  });

  const ruleArn = cdk.Arn.format({ service: 'iot', resource: 'rule', resourceName: RULE_NAME }, stack);

  notificationFn.addPermission('AllowIotInvokeNotificationCdk', {
    principal: new iam.ServicePrincipal('iot.amazonaws.com'),
    sourceArn: ruleArn,
  });

  return rule;
}
