# Midori-Mon-WaterWatcher AWS構成図

```mermaid
flowchart LR
    D["WaterWatcher Device<br/>01 / 02 / 03"]

    subgraph AWS["AWS (ap-northeast-1)"]
        IOT["IoT Core<br/>Thing Shadow"]
        RULE["IoT Rule<br/>Midori_Mon_WaterWatcher_Routing_cdk"]
        NLAMBDA["Notification Lambda<br/>Midori-Mon-WaterWatcher-Notification-cdk"]
        SSM["SSM Parameter Store<br/>Discord Webhook URL"]
        DDB[("DynamoDB<br/>MoistureSensor / DeviceBattery / TemperatureSensor")]
        APIGW["API Gateway<br/>Midori-Mon-WaterWatcher-Grafana-Graph-cdk"]
        GLAMBDA["Grafana-Graph Lambda<br/>Midori-Mon-WaterWatcher-Grafana-Graph-cdk"]
    end

    DISCORD["Discord"]
    GRAFANA["Grafana (Amazon Lightsail)<br/>CDK管理外"]

    D -- "MQTT / X.509証明書" --> IOT
    IOT -- "$aws/things/+/shadow/update/accepted" --> RULE
    RULE -- invoke --> NLAMBDA
    NLAMBDA -- PutItem --> DDB
    NLAMBDA -- GetParameter --> SSM
    NLAMBDA -- "Webhook POST" --> DISCORD
    NLAMBDA -. "GetThingShadow / UpdateThingShadow" .-> IOT

    GRAFANA -- "HTTPS + x-api-key" --> APIGW
    APIGW -- invoke --> GLAMBDA
    GLAMBDA -- Query --> DDB
```
