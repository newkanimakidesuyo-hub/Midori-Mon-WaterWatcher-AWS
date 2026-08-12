import { APIGatewayProxyHandler } from 'aws-lambda';

export const handler: APIGatewayProxyHandler = async (event) => {
  console.log('Midori-Mon-WaterWatcher-Notification-cdk invoked', { event });

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Notification CDK test OK' }),
  };
};
