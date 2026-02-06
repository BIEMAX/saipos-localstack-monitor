import React from 'react';
import ServiceMetricsSection from './ServiceMetricsSection';

interface S3Metrics {
  bucketsCount: number;
  objectsCount: number;
  totalSize: number;
  operationsCount: {
    putObject: number;
    getObject: number;
    deleteObject: number;
  };
}

const S3Section: React.FC = () => {
  const metrics: S3Metrics = {
    bucketsCount: 0,
    objectsCount: 0,
    totalSize: 0,
    operationsCount: {
      putObject: 0,
      getObject: 0,
      deleteObject: 0,
    },
  };

  return (
    <ServiceMetricsSection
      serviceName="S3"
      serviceKey="s3"
      metrics={metrics}
      metricsConfig={[
        { label: 'Buckets', value: metrics.bucketsCount, unit: '' },
        { label: 'Objects', value: metrics.objectsCount, unit: '' },
        { label: 'Total Size', value: (metrics.totalSize / 1024 / 1024).toFixed(2), unit: 'MB' },
        { label: 'PUT Operations', value: metrics.operationsCount.putObject, unit: '' },
        { label: 'GET Operations', value: metrics.operationsCount.getObject, unit: '' },
        { label: 'DELETE Operations', value: metrics.operationsCount.deleteObject, unit: '' },
      ]}
    />
  );
};

export default S3Section;