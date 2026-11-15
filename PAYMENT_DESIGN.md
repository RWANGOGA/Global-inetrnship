# Advanced Payment/Billing System Design

## Pricing Model (Simplified)

| Tier | Target | Price | Features |
|------|--------|-------|----------|
| **Free** | Students / Small orgs | $0 | Students: 30 apps/mo, Companies: 3 placements, basic review |
| **Pro** | Companies / Orgs | $30/mo | Unlimited placements, priority review (24h), talent search, ATS sync, branded page, analytics |
| **Enterprise** | Large orgs / Gov | Custom | SSO, dedicated manager, API access, invoice billing, custom retention |

**Student Billing:** Free up to 30 applications/month → $0.50 per application beyond 30

Student Plus and overage checkout offer Card (Stripe) and Flutterwave in development/test mode. The selected gateway, student ID, invoice, and gateway transaction reference are persisted for administrator review. These are mock checkouts only; production payments remain disabled until live provider integrations and credentials are configured.

---

## Database Schema (PostgreSQL)

### 1. `organisations` (extend existing)
```sql
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS billing_email VARCHAR;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS tax_id VARCHAR;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS billing_address JSONB;
```

### 2. `subscriptions` (extend existing)
```sql
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'active'; -- active, past_due, cancelled, trialing
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMP;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_end TIMESTAMP;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_gateway VARCHAR; -- stripe, paypal, flutterwave, mpesa, bank_transfer, crypto
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS gateway_customer_id VARCHAR;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS gateway_subscription_id VARCHAR;
```

### 3. `invoices` (NEW)
```sql
CREATE TABLE invoices (
    id VARCHAR PRIMARY KEY, -- inv_<uuid>
    org_id VARCHAR NOT NULL REFERENCES organisations(id),
    subscription_id VARCHAR REFERENCES subscriptions(org_id),
    amount_cents INTEGER NOT NULL, -- in cents (USD)
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR NOT NULL DEFAULT 'draft', -- draft, open, paid, void, uncollectible
    invoice_number VARCHAR UNIQUE NOT NULL, -- INV-2026-0001
    description TEXT,
    line_items JSONB NOT NULL, -- [{"description": "Pro Plan - Jan 2026", "quantity": 1, "unit_amount_cents": 3000}]
    metadata JSONB DEFAULT '{}',
    due_date TIMESTAMP,
    paid_at TIMESTAMP,
    payment_gateway VARCHAR,
    gateway_invoice_id VARCHAR,
    gateway_payment_intent_id VARCHAR,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_invoices_org ON invoices(org_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_number ON invoices(invoice_number);
```

### 4. `transactions` (NEW) - Immutable ledger
```sql
CREATE TABLE transactions (
    id VARCHAR PRIMARY KEY, -- txn_<uuid>
    org_id VARCHAR NOT NULL REFERENCES organisations(id),
    invoice_id VARCHAR REFERENCES invoices(id),
    subscription_id VARCHAR REFERENCES subscriptions(org_id),
    amount_cents INTEGER NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    type VARCHAR NOT NULL, -- payment, refund, chargeback, credit, fee
    status VARCHAR NOT NULL DEFAULT 'pending', -- pending, succeeded, failed, cancelled
    payment_gateway VARCHAR NOT NULL, -- stripe, paypal, flutterwave, mpesa, bank_transfer, crypto, manual
    gateway_transaction_id VARCHAR, -- external reference
    gateway_response JSONB, -- full gateway response for audit
    description TEXT,
    metadata JSONB DEFAULT '{}',
    idempotency_key VARCHAR UNIQUE, -- for exactly-once semantics
    created_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP
);

CREATE INDEX idx_transactions_org ON transactions(org_id);
CREATE INDEX idx_transactions_invoice ON transactions(invoice_id);
CREATE INDEX idx_transactions_gateway ON transactions(payment_gateway, gateway_transaction_id);
CREATE INDEX idx_transactions_idempotency ON transactions(idempotency_key);
```

### 5. `student_usage` (NEW) - Track student applications for billing
```sql
CREATE TABLE student_usage (
    id VARCHAR PRIMARY KEY,
    user_id VARCHAR NOT NULL REFERENCES users(id),
    month VARCHAR(7) NOT NULL, -- YYYY-MM
    application_count INTEGER DEFAULT 0,
    billed_count INTEGER DEFAULT 0, -- apps beyond 30 that were billed
    last_billed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, month)
);

CREATE INDEX idx_student_usage_user_month ON student_usage(user_id, month);
```

### 6. `payment_gateways` (NEW) - Configuration
```sql
CREATE TABLE payment_gateways (
    id VARCHAR PRIMARY KEY, -- e.g., 'stripe', 'paypal', 'flutterwave', 'mpesa', 'bank_transfer', 'crypto'
    name VARCHAR NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    config JSONB NOT NULL DEFAULT '{}', -- API keys, webhook secrets, etc. (encrypted)
    supported_currencies JSONB DEFAULT '["USD", "UGX", "EUR", "KES"]',
    supported_countries JSONB DEFAULT '[]',
    fee_percentage DECIMAL(5,4), -- e.g., 0.029 for 2.9%
    fee_fixed_cents INTEGER, -- e.g., 30 for $0.30
    min_amount_cents INTEGER,
    max_amount_cents INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Seed with mock gateways
INSERT INTO payment_gateways (id, name, enabled, config, fee_percentage, fee_fixed_cents) VALUES
('stripe', 'Stripe (Cards)', TRUE, '{"mode": "mock"}', 0.029, 30),
('paypal', 'PayPal', TRUE, '{"mode": "mock"}', 0.0349, 49),
('flutterwave', 'Flutterwave (Africa)', TRUE, '{"mode": "mock"}', 0.014, 0),
('mpesa', 'M-Pesa (Mobile Money)', TRUE, '{"mode": "mock"}', 0.01, 0),
('bank_transfer', 'Bank Transfer', TRUE, '{"mode": "mock"}', 0.005, 0),
('crypto', 'Crypto (USDC/USDT)', TRUE, '{"mode": "mock"}', 0.01, 0);
```

---

## Payment Gateway Abstraction

### Interface (Port)
```python
# app/application/ports.py
class PaymentGateway(ABC):
    """Abstract payment gateway - enables multiple providers with same interface."""
    
    @abstractmethod
    def create_customer(self, org_id: str, email: str, name: str, metadata: dict) -> GatewayCustomer: ...
    
    @abstractmethod
    def create_subscription(self, customer_id: str, price_id: str, trial_days: int = 0) -> GatewaySubscription: ...
    
    @abstractmethod
    def cancel_subscription(self, subscription_id: str, at_period_end: bool = True) -> GatewaySubscription: ...
    
    @abstractmethod
    def create_invoice(self, customer_id: str, line_items: list[InvoiceLineItem], metadata: dict) -> GatewayInvoice: ...
    
    @abstractmethod
    def finalize_invoice(self, invoice_id: str) -> GatewayInvoice: ...
    
    @abstractmethod
    def pay_invoice(self, invoice_id: str, payment_method_id: str = None) -> GatewayPayment: ...
    
    @abstractmethod
    def create_payment_method(self, customer_id: str, type: str, details: dict) -> GatewayPaymentMethod: ...
    
    @abstractmethod
    def handle_webhook(self, payload: bytes, signature: str) -> WebhookEvent: ...
    
    @abstractmethod
    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool: ...
    
    @abstractmethod
    def get_supported_currencies(self) -> list[str]: ...
    
    @abstractmethod
    def calculate_fees(self, amount_cents: int, currency: str) -> FeeBreakdown: ...
```

### Mock Implementation (for development)
```python
# app/infrastructure/payment_gateways/mock_gateway.py
class MockGateway(PaymentGateway):
    """Mock gateway for development - simulates all payment flows without external calls."""
    
    def __init__(self, gateway_id: str, config: dict):
        self.gateway_id = gateway_id
        self.config = config
        self._customers = {}
        self._subscriptions = {}
        self._invoices = {}
        self._payments = {}
        self._webhook_secret = config.get("webhook_secret", "mock_secret")
    
    # Implements all abstract methods with in-memory state
    # Simulates: success, failure, pending, webhook events
```

### Real Gateway Implementations (stubs for future)
```python
# app/infrastructure/payment_gateways/stripe_gateway.py
class StripeGateway(PaymentGateway):
    def __init__(self, api_key: str, webhook_secret: str):
        self.client = stripe.StripeClient(api_key)
        self.webhook_secret = webhook_secret
    # ... real implementations
```

---

## Billing Service (Application Layer) - ACID Guarantees

### Core Principles

```python
# app/application/services.py
class BillingService:
    """
    Billing service with ACID guarantees:
    - Atomicity: All DB changes in single transaction (SQLAlchemy session)
    - Consistency: Validate business rules before commit
    - Isolation: Use SELECT FOR UPDATE for concurrent operations
    - Durability: Commit only after all validations pass
    """
    
    def __init__(
        self,
        session: Session,
        subscription_repo: SubscriptionRepository,
        invoice_repo: InvoiceRepository,
        transaction_repo: TransactionRepository,
        gateway_factory: PaymentGatewayFactory,
        student_usage_repo: StudentUsageRepository,
    ):
        self._session = session
        self._subscriptions = subscription_repo
        self._invoices = invoice_repo
        self._transactions = transaction_repo
        self._gateways = gateway_factory
        self._student_usage = student_usage_repo
    
    # ============ COMPANY BILLING ============
    
    def create_subscription(
        self,
        org_id: str,
        plan: str,  # "pro" or "enterprise"
        billing_cycle: str = "monthly",  # monthly, annual
        payment_gateway: str = "stripe",
        payment_method_id: str = None,
    ) -> Subscription:
        """
        Atomic: Creates subscription + invoice + transaction in one transaction.
        Consistent: Validates plan exists, org exists, gateway enabled.
        Isolated: Uses row-level locks on organisation.
        Durable: Commits only after all records created.
        """
        with self._session.begin_nested():  # Savepoint for nested atomicity
            # 1. Lock organisation row
            org = self._session.query(OrganisationORM).filter_by(id=org_id).with_for_update().one()
            
            # 2. Validate
            self._validate_plan(plan)
            gateway = self._gateways.get(payment_gateway)
            self._validate_gateway(gateway, org.currency)
            
            # 3. Get/create gateway customer
            customer = gateway.get_or_create_customer(org)
            
            # 4. Create subscription in gateway
            gw_sub = gateway.create_subscription(customer.id, self._plan_to_price_id(plan, billing_cycle))
            
            # 5. Create local subscription record
            subscription = Subscription(
                org_id=org_id,
                plan=plan,
                billing=billing_cycle,
                status="active" if gw_sub.status == "active" else "trialing",
                current_period_start=gw_sub.current_period_start,
                current_period_end=gw_sub.current_period_end,
                payment_gateway=payment_gateway,
                gateway_customer_id=customer.id,
                gateway_subscription_id=gw_sub.id,
            )
            self._subscriptions.save(subscription)
            
            # 6. Create first invoice
            invoice = self._create_invoice_for_subscription(subscription, gateway)
            
            # 7. Attempt payment if payment_method provided
            if payment_method_id:
                self._pay_invoice(invoice.id, payment_method_id)
            
            return subscription
    
    def _create_invoice_for_subscription(self, subscription: Subscription, gateway: PaymentGateway) -> Invoice:
        """Create invoice for subscription period."""
        line_items = [{
            "description": f"{subscription.plan.title()} Plan - {subscription.billing}ly",
            "quantity": 1,
            "unit_amount_cents": self._plan_price_cents(subscription.plan, subscription.billing),
            "period_start": subscription.current_period_start.isoformat(),
            "period_end": subscription.current_period_end.isoformat(),
        }]
        
        gw_invoice = gateway.create_invoice(
            subscription.gateway_customer_id,
            line_items,
            metadata={"subscription_id": subscription.org_id, "plan": subscription.plan}
        )
        
        invoice = Invoice(
            id=f"inv_{uuid4().hex[:12]}",
            org_id=subscription.org_id,
            subscription_id=subscription.org_id,
            amount_cents=sum(item["unit_amount_cents"] * item["quantity"] for item in line_items),
            currency="USD",
            status="open",
            invoice_number=self._generate_invoice_number(),
            line_items=line_items,
            due_date=datetime.utcnow() + timedelta(days=7),
            payment_gateway=subscription.payment_gateway,
            gateway_invoice_id=gw_invoice.id,
        )
        self._invoices.save(invoice)
        
        # Create pending transaction record
        transaction = Transaction(
            id=f"txn_{uuid4().hex[:12]}",
            org_id=subscription.org_id,
            invoice_id=invoice.id,
            subscription_id=subscription.org_id,
            amount_cents=invoice.amount_cents,
            currency=invoice.currency,
            type="payment",
            status="pending",
            payment_gateway=subscription.payment_gateway,
            idempotency_key=f"inv_{invoice.id}_pay",
            description=f"Invoice {invoice.invoice_number} - {subscription.plan} plan",
        )
        self._transactions.save(transaction)
        
        return invoice
    
    def _pay_invoice(self, invoice_id: str, payment_method_id: str) -> Transaction:
        """Process payment for invoice - atomic with transaction record."""
        invoice = self._invoices.get(invoice_id)
        subscription = self._subscriptions.get(invoice.org_id)
        gateway = self._gateways.get(subscription.payment_gateway)
        
        # Idempotency: check if already paid
        existing = self._transactions.find_by_idempotency_key(f"inv_{invoice_id}_pay")
        if existing and existing.status == "succeeded":
            return existing
        
        # Attempt payment via gateway
        gw_payment = gateway.pay_invoice(invoice.gateway_invoice_id, payment_method_id)
        
        # Update transaction
        transaction = self._transactions.find_by_idempotency_key(f"inv_{invoice_id}_pay")
        transaction.status = "succeeded" if gw_payment.status == "succeeded" else "failed"
        transaction.gateway_transaction_id = gw_payment.id
        transaction.gateway_response = gw_payment.raw_response
        transaction.processed_at = datetime.utcnow()
        
        if transaction.status == "succeeded":
            invoice.status = "paid"
            invoice.paid_at = datetime.utcnow()
            invoice.gateway_payment_intent_id = gw_payment.id
        
        self._invoices.save(invoice)
        self._transactions.save(transaction)
        
        return transaction
    
    # ============ STUDENT BILLING ============
    
    def record_student_application(self, user_id: str) -> StudentUsage:
        """Track student application count for billing."""
        month = datetime.utcnow().strftime("%Y-%m")
        
        with self._session.begin_nested():
            usage = self._student_usage.get_or_create(user_id, month)
            usage.application_count += 1
            
            # Check if should bill (31st application)
            if usage.application_count == 31:
                self._bill_student_overage(user_id, usage)
            
            self._student_usage.save(usage)
            return usage
    
    def _bill_student_overage(self, user_id: str, usage: StudentUsage):
        """Bill student for applications beyond 30."""
        # Create invoice for overage
        overage_count = usage.application_count - 30
        amount_cents = overage_count * 50  # $0.50 per app
        
        invoice = Invoice(
            id=f"inv_{uuid4().hex[:12]}",
            org_id=user_id,  # student acts as their own "org" for billing
            amount_cents=amount_cents,
            currency="USD",
            status="open",
            invoice_number=self._generate_invoice_number(),
            line_items=[{
                "description": f"Applications over free tier (30/month)",
                "quantity": overage_count,
                "unit_amount_cents": 50,
            }],
            due_date=datetime.utcnow() + timedelta(days=7),
        )
        self._invoices.save(invoice)
        
        usage.billed_count = overage_count
        usage.last_billed_at = datetime.utcnow()
    
    # ============ WEBHOOK HANDLING ============
    
    def handle_webhook(self, gateway_id: str, payload: bytes, signature: str) -> WebhookEvent:
        """Process gateway webhook - update local state from external events."""
        gateway = self._gateways.get(gateway_id)
        event = gateway.handle_webhook(payload, signature)
        
        with self._session.begin_nested():
            if event.type == "invoice.payment_succeeded":
                self._handle_payment_succeeded(event)
            elif event.type == "invoice.payment_failed":
                self._handle_payment_failed(event)
            elif event.type == "customer.subscription.updated":
                self._handle_subscription_updated(event)
            elif event.type == "customer.subscription.deleted":
                self._handle_subscription_cancelled(event)
        
        return event
    
    def _handle_payment_succeeded(self, event: WebhookEvent):
        """Update invoice/transaction on successful payment."""
        gw_invoice = event.data["invoice"]
        invoice = self._invoices.find_by_gateway_id(gw_invoice["id"])
        if invoice:
            invoice.status = "paid"
            invoice.paid_at = datetime.utcnow()
            invoice.gateway_payment_intent_id = gw_invoice.get("payment_intent")
            
            transaction = self._transactions.find_by_invoice_and_type(invoice.id, "payment")
            if transaction:
                transaction.status = "succeeded"
                transaction.gateway_transaction_id = gw_invoice.get("payment_intent")
                transaction.gateway_response = event.raw_data
                transaction.processed_at = datetime.utcnow()
            
            self._invoices.save(invoice)
            if transaction:
                self._transactions.save(transaction)
    
    # ============ ADMIN ANALYTICS ============
    
    def get_revenue_analytics(self, start_date: datetime, end_date: datetime) -> RevenueAnalytics:
        """Admin: Revenue breakdown by gateway, plan, org type."""
        # Aggregated queries for admin dashboard
        pass
    
    def get_outstanding_invoices(self) -> list[Invoice]:
        """Admin: All unpaid invoices past due date."""
        pass
```

---

## API Endpoints

### Company/Org Endpoints
```
POST   /billing/subscriptions           # Create/upgrade subscription
GET    /billing/subscriptions/current   # Get current subscription
POST   /billing/subscriptions/cancel    # Cancel at period end
POST   /billing/subscriptions/resume    # Resume cancelled subscription
GET    /billing/invoices                # List invoices
GET    /billing/invoices/{id}           # Get invoice details
POST   /billing/invoices/{id}/pay       # Pay invoice
GET    /billing/payment-methods         # List saved payment methods
POST   /billing/payment-methods         # Add payment method
DELETE /billing/payment-methods/{id}    # Remove payment method
GET    /billing/usage                   # Current period usage
GET    /billing/history                 # Payment history
```

### Student Endpoints
```
GET    /billing/student/usage           # Current month application count
GET    /billing/student/invoices        # Student's overage invoices
POST   /billing/student/invoices/{id}/pay
```

### Admin Endpoints
```
GET    /admin/billing/revenue           # Revenue analytics
GET    /admin/billing/invoices          # All invoices (filterable)
GET    /admin/billing/transactions      # All transactions
GET    /admin/billing/subscriptions     # All subscriptions
GET    /admin/billing/gateways          # Gateway status/config
POST   /admin/billing/gateways          # Configure gateway
GET    /admin/billing/outstanding       # Overdue invoices
POST   /admin/billing/invoices/{id}/void
POST   /admin/billing/refunds           # Process refund
```

### Webhook Endpoints
```
POST   /webhooks/stripe
POST   /webhooks/paypal
POST   /webhooks/flutterwave
POST   /webhooks/mpesa
POST   /webhooks/bank_transfer
POST   /webhooks/crypto
```

---

## Frontend Components

### 1. Company Dashboard - Billing Tab
- **Plan Card**: Current plan, status, next billing date, price
- **Usage Meter**: Placements used / limit, applications this month
- **Payment Methods**: Cards, bank accounts, mobile money
- **Invoice Table**: List with status, amount, due date, pay button
- **Upgrade/Downgrade**: Plan selector with proration preview
- **Billing Email**: Update notification email

### 2. Student Dashboard - Billing
- **Application Counter**: X/30 this month (green/yellow/red)
- **Overage Notice**: When >30, show pending charge
- **Invoice History**: Past overage invoices

### 3. Admin Dashboard - Billing Analytics
- **Revenue Overview**: MRR, ARR, churn, new MRR
- **By Gateway**: Volume, success rate, fees
- **By Plan**: Distribution, upgrades/downgrades
- **Outstanding**: Overdue invoices table
- **Transaction Log**: Searchable, filterable
- **Gateway Health**: Success rates, latency

---

## Migration Strategy

### Phase 1: Core Infrastructure (Week 1)
1. Add new tables (invoices, transactions, student_usage, payment_gateways)
2. Extend subscriptions table
3. Create PaymentGateway port + MockGateway
3. Implement BillingService with ACID transactions
4. Basic CRUD endpoints

### Phase 2: Company Billing (Week 2)
1. Subscription create/upgrade/cancel
2. Invoice generation + payment flow
3. Mock gateway integration (Stripe, PayPal, Flutterwave, M-Pesa, Bank, Crypto)
4. Company billing dashboard

### Phase 3: Student Billing (Week 3)
1. Application counter + 30 free limit
4. Overage invoicing ($0.50/app)
5. Student billing UI

### Phase 4: Admin & Polish (Week 4)
1. Admin billing analytics
2. Webhook handling for all gateways
3. Email notifications (invoice created, payment succeeded/failed)
4. PDF invoice generation
5. Testing & edge cases

---

## ACID Compliance Checklist

| Operation | Atomicity | Consistency | Isolation | Durability |
|-----------|-----------|-------------|-----------|------------|
| Create subscription | Single transaction | Plan validation, org exists | Row lock on org | Commit after all |
| Pay invoice | Single transaction | Invoice open, amount matches | Row lock on invoice | Commit after gateway confirms |
| Record student app | Single transaction | Month boundary | Row lock on usage | Commit after count |
| Webhook processing | Single transaction | Idempotency key | Row lock on invoice | Commit after update |
| Refund | Single transaction | Original payment succeeded | Row lock on transaction | Commit after gateway confirms |

---

## Error Handling & Edge Cases

1. **Idempotency**: All payment operations use idempotency keys
2. **Partial failures**: Savepoints allow rollback of sub-operations
3. **Gateway timeout**: Mark transaction pending, retry via background job
4. **Currency mismatch**: Validate gateway supports org currency
5. **Plan changes mid-cycle**: Proration calculated, credit invoice created
6. **Failed webhook**: Dead letter queue, manual replay endpoint
7. **Concurrent upgrades**: Row-level locking prevents race conditions

---

## Security

- Gateway credentials encrypted at rest (using Fernet/AES)
- Webhook signatures verified on every request
- PCI compliance: Never store raw card data
- Audit logging on all billing operations
- Role-based access: Employers see own, Admins see all