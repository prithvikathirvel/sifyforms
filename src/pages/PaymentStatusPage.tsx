import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '../components/ui/button';

export default function PaymentStatusPage() {
  const [params] = useSearchParams();

  const cancelled = params.get('cancelled') === 'true';
  const failed = params.get('status') === 'failed' || params.get('STATUS') === 'TXN_FAILURE';

  const isSuccess = !cancelled && !failed;

  const txnId =
    params.get('txnId') ||
    params.get('razorpay_payment_id') ||
    params.get('TXNID') ||
    params.get('txnid') ||
    params.get('mihpayid') ||
    params.get('transaction_id') ||
    null;

  const orderId =
    params.get('order_id') ||
    params.get('ORDERID') ||
    params.get('razorpay_order_id') ||
    null;

  const gateway = params.get('gateway') || null;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          {isSuccess
            ? <CheckCircle2 className="h-20 w-20 text-green-500" />
            : <XCircle className="h-20 w-20 text-destructive" />
          }
        </div>

        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {isSuccess ? 'Payment Successful' : cancelled ? 'Payment Cancelled' : 'Payment Failed'}
          </h1>
          <p className="text-muted-foreground">
            {isSuccess
              ? 'Your payment has been processed successfully.'
              : cancelled
              ? 'You cancelled the payment. No amount was charged.'
              : 'Your payment could not be processed. Please try again.'}
          </p>
        </div>

        {isSuccess && txnId && (
          <div className="bg-muted rounded-lg p-4 text-left space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Transaction ID</p>
            <p className="text-sm font-mono font-semibold break-all">{txnId}</p>
            {gateway && (
              <p className="text-xs text-muted-foreground capitalize mt-1">via {gateway}</p>
            )}
          </div>
        )}

        {!isSuccess && orderId && (
          <div className="bg-muted rounded-lg p-4 text-left space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Order ID</p>
            <p className="text-sm font-mono font-semibold break-all">{orderId}</p>
          </div>
        )}

        {isSuccess && (
          <p className="text-sm text-muted-foreground">
            Please save your Transaction ID for future reference.
          </p>
        )}

        {!isSuccess && !cancelled && (
          <p className="text-sm text-muted-foreground">
            If money was deducted, it will be refunded within 5–7 business days.
          </p>
        )}

        <div className="space-y-2">
          <Button variant="outline" className="w-full" onClick={() => window.history.back()}>
            Go Back
          </Button>
          <Link to="/">
            <Button variant="ghost" className="w-full">Back to Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
