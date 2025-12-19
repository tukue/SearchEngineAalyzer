import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Lock, Zap, Crown, AlertTriangle } from 'lucide-react';

interface PlanInfo {
  currentPlan: 'free' | 'pro';
  entitlements: {
    monthlyAuditLimit: number;
    historyDepth: number;
    exportsEnabled: boolean;
    webhooksEnabled: boolean;
    apiAccessEnabled: boolean;
  };
  tenantId: number;
}

interface PlanGatingError {
  code: 'PLAN_UPGRADE_REQUIRED' | 'QUOTA_EXCEEDED' | 'FEATURE_NOT_AVAILABLE';
  feature: string;
  currentPlan: string;
  requiredPlan?: string;
  message: string;
}

// Hook to fetch plan information
export function usePlanInfo() {
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/plan')
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        // Validate response structure
        if (data && typeof data.currentPlan === 'string' && data.entitlements) {
          setPlanInfo(data);
        } else {
          throw new Error('Invalid plan data structure');
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch plan info:', err);
        setLoading(false);
      });
  }, []);

  return { planInfo, loading };
}

// Component to show upgrade prompt
export function UpgradePrompt({ feature, currentPlan, onUpgrade }: {
  feature: string;
  currentPlan: string;
  onUpgrade?: () => void;
}) {
  return (
    <Alert className="border-amber-200 bg-amber-50">
      <Crown className="h-4 w-4 text-amber-600" />
      <AlertDescription className="flex items-center justify-between">
        <span>
          <strong>{feature}</strong> requires Pro plan. Current: {currentPlan}
        </span>
        <Button 
          size="sm" 
          className="ml-4"
          onClick={onUpgrade}
        >
          Upgrade to Pro
        </Button>
      </AlertDescription>
    </Alert>
  );
}

// Component to show quota exceeded
export function QuotaExceededPrompt({ feature, currentPlan, onUpgrade }: {
  feature: string;
  currentPlan: string;
  onUpgrade?: () => void;
}) {
  return (
    <Alert className="border-red-200 bg-red-50">
      <AlertTriangle className="h-4 w-4 text-red-600" />
      <AlertDescription className="flex items-center justify-between">
        <span>
          Monthly <strong>{feature}</strong> quota exceeded for {currentPlan} plan
        </span>
        <Button 
          size="sm" 
          variant="destructive"
          className="ml-4"
          onClick={onUpgrade}
        >
          Upgrade to Pro
        </Button>
      </AlertDescription>
    </Alert>
  );
}

// Component to show feature availability
export function FeatureGate({ 
  feature, 
  enabled, 
  children, 
  fallback 
}: {
  feature: string;
  enabled: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  if (enabled) {
    return <>{children}</>;
  }

  return fallback || (
    <div className="relative">
      <div className="opacity-50 pointer-events-none">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded">
        <div className="text-center">
          <Lock className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600">
            {feature} requires Pro plan
          </p>
        </div>
      </div>
    </div>
  );
}

// Plan comparison component
export function PlanComparison({ currentPlan }: { currentPlan: 'free' | 'pro' }) {
  const plans = {
    free: {
      name: 'Free',
      price: '$0',
      features: [
        '10 audits per month',
        '5 analysis history',
        'Basic recommendations',
        'No exports'
      ]
    },
    pro: {
      name: 'Pro',
      price: '$29',
      features: [
        '1,000 audits per month',
        '100 analysis history',
        'Advanced recommendations',
        'PDF & HTML exports',
        'API access',
        'Webhooks (coming soon)'
      ]
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {Object.entries(plans).map(([planKey, plan]) => (
        <Card key={planKey} className={`relative ${planKey === currentPlan ? 'ring-2 ring-blue-500' : ''}`}>
          {planKey === currentPlan && (
            <Badge className="absolute -top-2 left-4 bg-blue-500">
              Current Plan
            </Badge>
          )}
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {planKey === 'pro' && <Crown className="h-5 w-5 text-amber-500" />}
              {plan.name}
            </CardTitle>
            <CardDescription>
              <span className="text-2xl font-bold">{plan.price}</span>
              {planKey === 'pro' && <span className="text-sm">/month</span>}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {plan.features.map((feature, index) => (
                <li key={index} className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-green-500" />
                  <span className="text-sm">{feature}</span>
                </li>
              ))}
            </ul>
            {planKey !== currentPlan && (
              <Button className="w-full mt-4">
                {planKey === 'pro' ? 'Upgrade to Pro' : 'Downgrade to Free'}
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Hook to handle plan gating errors
export function usePlanGatingErrorHandler() {
  const [error, setError] = useState<PlanGatingError | null>(null);

  const handleError = (err: any) => {
    if (err.code && ['PLAN_UPGRADE_REQUIRED', 'QUOTA_EXCEEDED', 'FEATURE_NOT_AVAILABLE'].includes(err.code)) {
      setError(err);
    }
  };

  const clearError = () => setError(null);

  const ErrorComponent = error ? (
    error.code === 'QUOTA_EXCEEDED' ? (
      <QuotaExceededPrompt 
        feature={error.feature}
        currentPlan={error.currentPlan}
        onUpgrade={() => {
          // Handle upgrade logic
          clearError();
        }}
      />
    ) : (
      <UpgradePrompt 
        feature={error.feature}
        currentPlan={error.currentPlan}
        onUpgrade={() => {
          // Handle upgrade logic
          clearError();
        }}
      />
    )
  ) : null;

  return { error, handleError, clearError, ErrorComponent };
}