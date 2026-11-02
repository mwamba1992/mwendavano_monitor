CREATE SCHEMA core;
CREATE TYPE core.cash_movement_method_enum AS ENUM (
    'cash',
    'mpesa',
    'tigo_pesa',
    'airtel_money',
    'bank'
);
CREATE TYPE core.cash_movement_source_enum AS ENUM (
    'sale',
    'debt_payment',
    'refund',
    'expense',
    'purchase',
    'owner_draw',
    'owner_contribution',
    'transfer',
    'opening_balance',
    'manual_adjustment'
);
CREATE TYPE core.cash_movement_type_enum AS ENUM (
    'in',
    'out'
);
CREATE TYPE core.debt_payment_method_enum AS ENUM (
    'cash',
    'mpesa',
    'tigo_pesa',
    'airtel_money',
    'bank'
);
CREATE TYPE core.item_condition_enum AS ENUM (
    'new',
    'used'
);
CREATE TYPE core.phone_otp_purpose_enum AS ENUM (
    'set_password',
    'shop_signup',
    'staff_reset',
    'staff_login',
    'buyer_login',
    'account_delete'
);
CREATE TYPE core.product_review_status_enum AS ENUM (
    'published',
    'hidden'
);
CREATE TYPE core.sale_receipt_payment_method_enum AS ENUM (
    'cash',
    'mpesa',
    'tigo_pesa',
    'airtel_money',
    'bank',
    'card',
    'credit'
);
CREATE TYPE core.sale_return_refund_method_enum AS ENUM (
    'cash',
    'mpesa',
    'tigo_pesa',
    'airtel_money',
    'bank',
    'card',
    'credit'
);
CREATE TYPE core.sale_status_enum AS ENUM (
    'pending',
    'confirmed',
    'processing',
    'ready',
    'delivered',
    'cancelled'
);
CREATE TYPE core.sms_messages_status_enum AS ENUM (
    'sent',
    'failed'
);
CREATE TYPE core.whatsapp_orders_ordersource_enum AS ENUM (
    'whatsapp',
    'ecommerce',
    'pos',
    'phone'
);
CREATE TYPE core.whatsapp_orders_paymentmethod_enum AS ENUM (
    'cash_on_delivery',
    'mobile_money',
    'bank_transfer',
    'card'
);
CREATE TYPE core.whatsapp_orders_paymentstatus_enum AS ENUM (
    'pending',
    'paid',
    'failed',
    'refunded'
);
CREATE TYPE core.whatsapp_orders_status_enum AS ENUM (
    'pending',
    'confirmed',
    'processing',
    'ready',
    'delivered',
    'cancelled'
);
CREATE TYPE core.whatsapp_sessions_state_enum AS ENUM (
    'main_menu',
    'browsing_categories',
    'viewing_items',
    'searching',
    'searching_by_code',
    'adding_to_cart',
    'cart_review',
    'entering_address',
    'confirming_order',
    'tracking_order',
    'rating_order',
    'providing_feedback',
    'viewing_order_history',
    'selecting_reorder'
);
CREATE TABLE core.accounts (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    "codeId" integer,
    "typeId" integer,
    parent_account_id integer,
    business_id integer
);
CREATE SEQUENCE core.accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.accounts_id_seq OWNED BY core.accounts.id;
CREATE TABLE core.billing_checkout (
    id integer NOT NULL,
    order_id character varying(60) NOT NULL,
    business_id integer NOT NULL,
    plan character varying(12) NOT NULL,
    period character varying(6) NOT NULL,
    amount numeric(12,2) NOT NULL,
    phone character varying(20) NOT NULL,
    status character varying(12) DEFAULT 'pending'::character varying NOT NULL,
    selcom_status character varying(20),
    transid character varying(80),
    channel character varying(30),
    reference character varying(80),
    payment_token character varying(40),
    qr text,
    gateway_url text,
    push_sent_at timestamp without time zone,
    push_count integer DEFAULT 0 NOT NULL,
    last_checked_at timestamp without time zone,
    completed_at timestamp without time zone,
    subscription_payment_id integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    provider character varying(10) DEFAULT 'selcom'::character varying NOT NULL,
    fail_reason character varying(200),
    auto_renew boolean DEFAULT false NOT NULL,
    source character varying(10) DEFAULT 'shop'::character varying NOT NULL
);
CREATE SEQUENCE core.billing_checkout_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.billing_checkout_id_seq OWNED BY core.billing_checkout.id;
CREATE TABLE core.brand (
    id integer NOT NULL,
    name character varying NOT NULL,
    description character varying,
    "logoUrl" character varying,
    website character varying,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    business_id integer
);
CREATE SEQUENCE core.brand_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.brand_id_seq OWNED BY core.brand.id;
CREATE TABLE core.business (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    phone character varying(255),
    email character varying(255),
    website character varying(255),
    "categoryId" integer,
    whatsapp_phone_number_id character varying,
    whatsapp_access_token character varying,
    admin_phone_number character varying,
    address character varying(255),
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    registered_at timestamp without time zone,
    last_ads_sent_at timestamp without time zone,
    warranty_terms text,
    market_listed boolean DEFAULT false NOT NULL,
    slug character varying(80),
    logo_url character varying(500),
    daily_summary_sms boolean DEFAULT true NOT NULL,
    last_summary_on character varying(10)
);
CREATE SEQUENCE core.business_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.business_id_seq OWNED BY core.business.id;
CREATE TABLE core.buyer (
    id integer NOT NULL,
    phone character varying(20) NOT NULL,
    name character varying(120),
    email character varying(160),
    city character varying(80),
    region character varying(80),
    address text,
    token_version integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE TABLE core.buyer_device (
    id integer NOT NULL,
    token character varying(400) NOT NULL,
    buyer_id integer NOT NULL,
    platform character varying(10) DEFAULT 'android'::character varying NOT NULL,
    lang character varying(2) DEFAULT 'sw'::character varying NOT NULL
);
CREATE SEQUENCE core.buyer_device_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.buyer_device_id_seq OWNED BY core.buyer_device.id;
CREATE SEQUENCE core.buyer_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.buyer_id_seq OWNED BY core.buyer.id;
CREATE TABLE core.cash_movement (
    id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    created_by character varying(255),
    updated_by character varying(255),
    deleted boolean DEFAULT false NOT NULL,
    deleted_by character varying(255),
    active boolean DEFAULT true NOT NULL,
    action text,
    business_id integer,
    type core.cash_movement_type_enum NOT NULL,
    source core.cash_movement_source_enum NOT NULL,
    source_id integer,
    amount numeric(12,2) NOT NULL,
    method core.cash_movement_method_enum DEFAULT 'cash'::core.cash_movement_method_enum NOT NULL,
    notes text,
    occurred_at timestamp without time zone NOT NULL
);
CREATE SEQUENCE core.cash_movement_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.cash_movement_id_seq OWNED BY core.cash_movement.id;
CREATE TABLE core.chat_conversation (
    id integer NOT NULL,
    business_id integer NOT NULL,
    buyer_id integer NOT NULL,
    last_message_at timestamp with time zone DEFAULT now() NOT NULL,
    last_preview character varying(140) DEFAULT ''::character varying NOT NULL,
    last_sender character varying(5),
    buyer_unread integer DEFAULT 0 NOT NULL,
    shop_unread integer DEFAULT 0 NOT NULL,
    blocked_by_buyer boolean DEFAULT false NOT NULL,
    blocked_by_shop boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE core.chat_conversation_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.chat_conversation_id_seq OWNED BY core.chat_conversation.id;
CREATE TABLE core.chat_message (
    id integer NOT NULL,
    conversation_id integer NOT NULL,
    sender character varying(5) NOT NULL,
    sender_user_id integer,
    body character varying(1000) DEFAULT ''::character varying NOT NULL,
    image_url character varying(500),
    item_id integer,
    order_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE core.chat_message_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.chat_message_id_seq OWNED BY core.chat_message.id;
CREATE TABLE core.chat_report (
    id integer NOT NULL,
    conversation_id integer NOT NULL,
    message_id integer,
    reported_by character varying(5) NOT NULL,
    reason character varying(300) DEFAULT ''::character varying NOT NULL,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE core.chat_report_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.chat_report_id_seq OWNED BY core.chat_report.id;
CREATE TABLE core.color_categories (
    id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    created_by character varying(255),
    updated_by character varying(255),
    deleted boolean DEFAULT false NOT NULL,
    deleted_by character varying(255),
    active boolean DEFAULT true NOT NULL,
    action text,
    name character varying NOT NULL,
    "hexCode" character varying,
    description character varying,
    business_id integer
);
CREATE SEQUENCE core.color_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.color_categories_id_seq OWNED BY core.color_categories.id;
CREATE TABLE core.common (
    id integer NOT NULL,
    code character varying(100) NOT NULL,
    description character varying(100) NOT NULL,
    type character varying(100) NOT NULL,
    "parentCategoryId" integer,
    business_id integer
);
CREATE SEQUENCE core.common_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.common_id_seq OWNED BY core.common.id;
CREATE TABLE core.customer (
    id integer NOT NULL,
    name character varying NOT NULL,
    phone character varying NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    email character varying,
    city character varying,
    region character varying,
    password character varying,
    "hasPassword" boolean DEFAULT false NOT NULL,
    business_id integer
);
CREATE SEQUENCE core.customer_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.customer_id_seq OWNED BY core.customer.id;
CREATE TABLE core.debt_payment (
    id integer NOT NULL,
    business_id integer NOT NULL,
    receipt_id integer NOT NULL,
    customer_id integer NOT NULL,
    amount numeric(12,2) NOT NULL,
    method core.debt_payment_method_enum DEFAULT 'cash'::core.debt_payment_method_enum NOT NULL,
    paid_at timestamp without time zone NOT NULL,
    notes text,
    recorded_by_user_id integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE core.debt_payment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.debt_payment_id_seq OWNED BY core.debt_payment.id;
CREATE TABLE core.device_token (
    id integer NOT NULL,
    token character varying(400) NOT NULL,
    user_id integer NOT NULL,
    business_id integer NOT NULL,
    platform character varying(10) DEFAULT 'android'::character varying NOT NULL,
    lang character varying(2) DEFAULT 'sw'::character varying NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE core.device_token_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.device_token_id_seq OWNED BY core.device_token.id;
CREATE TABLE core.expense (
    id integer NOT NULL,
    title character varying NOT NULL,
    amount numeric(12,2) NOT NULL,
    category character varying NOT NULL,
    description text,
    "expenseDate" date NOT NULL,
    "createdBy" character varying NOT NULL,
    business_id integer
);
CREATE SEQUENCE core.expense_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.expense_id_seq OWNED BY core.expense.id;
CREATE TABLE core.inventory_transactions (
    id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    created_by character varying(255),
    updated_by character varying(255),
    deleted boolean DEFAULT false NOT NULL,
    deleted_by character varying(255),
    active boolean DEFAULT true NOT NULL,
    action text,
    "transactionType" character varying NOT NULL,
    quantity integer NOT NULL,
    "unitPrice" numeric(10,2) NOT NULL,
    "unitCost" numeric(10,2) NOT NULL,
    "totalPrice" numeric(10,2) NOT NULL,
    "referenceNumber" character varying,
    notes text,
    "inventoryImpact" numeric(15,2) NOT NULL,
    "revenueImpact" numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    "cogsImpact" numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    "transactionDate" timestamp without time zone DEFAULT now() NOT NULL,
    item_id integer,
    business_id integer
);
CREATE SEQUENCE core.inventory_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.inventory_transactions_id_seq OWNED BY core.inventory_transactions.id;
CREATE TABLE core.item (
    id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    created_by character varying(255),
    updated_by character varying(255),
    deleted boolean DEFAULT false NOT NULL,
    deleted_by character varying(255),
    active boolean DEFAULT true NOT NULL,
    action text,
    name character varying NOT NULL,
    "desc" character varying,
    "categoryId" integer,
    "warehouseId" integer,
    business_id integer,
    "supplierId" integer,
    code character varying,
    "imageUrl" character varying,
    condition core.item_condition_enum DEFAULT 'new'::core.item_condition_enum NOT NULL,
    "subcategoryId" integer,
    "brandId" integer
);
CREATE TABLE core.item_account_mapping (
    id integer NOT NULL,
    "itemId" integer,
    sale_account_id integer NOT NULL,
    inventory_account_id integer NOT NULL,
    cogs_account_id integer NOT NULL
);
CREATE SEQUENCE core.item_account_mapping_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.item_account_mapping_id_seq OWNED BY core.item_account_mapping.id;
CREATE SEQUENCE core.item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.item_id_seq OWNED BY core.item.id;
CREATE TABLE core.item_image (
    id integer NOT NULL,
    item_id integer NOT NULL,
    url character varying NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE core.item_image_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.item_image_id_seq OWNED BY core.item_image.id;
CREATE TABLE core.item_price (
    id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    created_by character varying(255),
    updated_by character varying(255),
    deleted boolean DEFAULT false NOT NULL,
    deleted_by character varying(255),
    active boolean DEFAULT true NOT NULL,
    action text,
    "purchaseAmount" integer NOT NULL,
    "freightAmount" integer NOT NULL,
    "profitMargin" numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    "sellingPrice" integer NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "itemId" integer
);
CREATE SEQUENCE core.item_price_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.item_price_id_seq OWNED BY core.item_price.id;
CREATE TABLE core.item_stock (
    id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    created_by character varying(255),
    updated_by character varying(255),
    deleted boolean DEFAULT false NOT NULL,
    deleted_by character varying(255),
    active boolean DEFAULT true NOT NULL,
    action text,
    quantity integer DEFAULT 0 NOT NULL,
    "reorderPoint" integer,
    "itemId" integer,
    "warehouseId" integer,
    "inTransit" integer DEFAULT 0 NOT NULL,
    low_alert_qty integer
);
CREATE TABLE core.item_stock_distribution (
    id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    created_by character varying(255),
    updated_by character varying(255),
    deleted boolean DEFAULT false NOT NULL,
    deleted_by character varying(255),
    active boolean DEFAULT true NOT NULL,
    action text,
    quantity integer DEFAULT 0 NOT NULL,
    "itemStockId" integer,
    "colorCategoryId" integer
);
CREATE SEQUENCE core.item_stock_distribution_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.item_stock_distribution_id_seq OWNED BY core.item_stock_distribution.id;
CREATE SEQUENCE core.item_stock_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.item_stock_id_seq OWNED BY core.item_stock.id;
CREATE TABLE core.item_supplier (
    id integer NOT NULL,
    "supplierName" character varying NOT NULL,
    location character varying NOT NULL,
    "contactEmail" character varying,
    "contactPhone" character varying,
    notes character varying,
    business_id integer
);
CREATE SEQUENCE core.item_supplier_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.item_supplier_id_seq OWNED BY core.item_supplier.id;
CREATE TABLE core.meta_ad_insights (
    id integer NOT NULL,
    business_id integer,
    campaign_id character varying NOT NULL,
    campaign_name character varying NOT NULL,
    adset_id character varying,
    adset_name character varying,
    ad_id character varying,
    ad_name character varying,
    date date NOT NULL,
    spend numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    impressions integer DEFAULT 0 NOT NULL,
    clicks integer DEFAULT 0 NOT NULL,
    conversions integer DEFAULT 0 NOT NULL,
    reach integer DEFAULT 0 NOT NULL,
    frequency numeric(10,4) DEFAULT '0'::numeric NOT NULL,
    cpc numeric(10,4) DEFAULT '0'::numeric NOT NULL,
    cpm numeric(10,4) DEFAULT '0'::numeric NOT NULL,
    ctr numeric(10,4) DEFAULT '0'::numeric NOT NULL,
    actions jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    ad_creative_body text
);
CREATE SEQUENCE core.meta_ad_insights_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.meta_ad_insights_id_seq OWNED BY core.meta_ad_insights.id;
CREATE TABLE core.notification (
    id integer NOT NULL,
    business_id integer NOT NULL,
    type character varying(20) NOT NULL,
    title character varying(160) NOT NULL,
    body character varying(400) DEFAULT ''::character varying NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    link character varying(120),
    dedupe_key character varying(100) NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE core.notification_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.notification_id_seq OWNED BY core.notification.id;
CREATE TABLE core.payment_webhook (
    id integer NOT NULL,
    provider character varying(10) NOT NULL,
    event character varying(40),
    order_reference character varying(60),
    status character varying(20),
    amount numeric(12,2),
    checksum_valid boolean,
    matched boolean DEFAULT false NOT NULL,
    payload jsonb NOT NULL,
    received_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE core.payment_webhook_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.payment_webhook_id_seq OWNED BY core.payment_webhook.id;
CREATE TABLE core.permission (
    id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    created_by character varying(255),
    updated_by character varying(255),
    deleted boolean DEFAULT false NOT NULL,
    deleted_by character varying(255),
    active boolean DEFAULT true NOT NULL,
    action text,
    name character varying NOT NULL,
    "desc" character varying NOT NULL
);
CREATE SEQUENCE core.permission_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.permission_id_seq OWNED BY core.permission.id;
CREATE TABLE core.phone_otp (
    id integer NOT NULL,
    phone character varying NOT NULL,
    purpose core.phone_otp_purpose_enum DEFAULT 'set_password'::core.phone_otp_purpose_enum NOT NULL,
    "codeHash" character varying NOT NULL,
    "expiresAt" timestamp without time zone NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    "consumedAt" timestamp without time zone,
    business_id integer,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE core.phone_otp_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.phone_otp_id_seq OWNED BY core.phone_otp.id;
CREATE TABLE core.product_review (
    id integer NOT NULL,
    item_id integer NOT NULL,
    order_id integer NOT NULL,
    business_id integer NOT NULL,
    customer_phone character varying NOT NULL,
    display_name character varying NOT NULL,
    rating integer NOT NULL,
    comment text,
    status core.product_review_status_enum DEFAULT 'published'::core.product_review_status_enum NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE core.product_review_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.product_review_id_seq OWNED BY core.product_review.id;
CREATE TABLE core.role (
    id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    created_by character varying(255),
    updated_by character varying(255),
    deleted boolean DEFAULT false NOT NULL,
    deleted_by character varying(255),
    active boolean DEFAULT true NOT NULL,
    action text,
    name character varying NOT NULL,
    "desc" character varying NOT NULL
);
CREATE SEQUENCE core.role_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.role_id_seq OWNED BY core.role.id;
CREATE TABLE core.role_permissions_permission (
    "roleId" integer NOT NULL,
    "permissionId" integer NOT NULL
);
CREATE TABLE core.role_user (
    user_id integer NOT NULL,
    role_id integer NOT NULL
);
CREATE TABLE core.sale (
    id integer NOT NULL,
    quantity integer NOT NULL,
    "amountPaid" numeric(10,2) NOT NULL,
    remarks character varying,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    customer_id integer,
    item_id integer,
    warehouse_id integer,
    status core.sale_status_enum DEFAULT 'pending'::core.sale_status_enum NOT NULL,
    whatsapp_notified boolean DEFAULT false NOT NULL,
    delivered_at timestamp without time zone,
    business_id integer,
    unit_cost numeric(12,2),
    receipt_id integer,
    serial_number character varying(300),
    return_of_sale_id integer,
    returned_quantity integer DEFAULT 0 NOT NULL
);
CREATE SEQUENCE core.sale_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.sale_id_seq OWNED BY core.sale.id;
CREATE TABLE core.sale_receipt (
    id integer NOT NULL,
    receipt_number character varying,
    business_id integer NOT NULL,
    payment_method core.sale_receipt_payment_method_enum DEFAULT 'cash'::core.sale_receipt_payment_method_enum NOT NULL,
    total_amount numeric(12,2) NOT NULL,
    remarks text,
    created_by_user_id integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    customer_id integer,
    warehouse_id integer,
    warranty_value integer,
    warranty_unit character varying(10),
    warranty_until date,
    debt_status character varying(12) DEFAULT 'none'::character varying NOT NULL,
    due_date date,
    write_off_reason text,
    return_credit numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    client_ref character varying(64)
);
CREATE SEQUENCE core.sale_receipt_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.sale_receipt_id_seq OWNED BY core.sale_receipt.id;
CREATE TABLE core.sale_return (
    id integer NOT NULL,
    return_number character varying,
    business_id integer NOT NULL,
    receipt_id integer NOT NULL,
    refund_method core.sale_return_refund_method_enum DEFAULT 'cash'::core.sale_return_refund_method_enum NOT NULL,
    refund_amount numeric(12,2) NOT NULL,
    cash_refund numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    credit_reduced numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    reason text,
    created_by_user_id integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE core.sale_return_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.sale_return_id_seq OWNED BY core.sale_return.id;
CREATE TABLE core.sale_return_line (
    id integer NOT NULL,
    sale_id integer NOT NULL,
    item_id integer NOT NULL,
    item_name character varying,
    quantity integer NOT NULL,
    value numeric(12,2) NOT NULL,
    return_id integer
);
CREATE SEQUENCE core.sale_return_line_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.sale_return_line_id_seq OWNED BY core.sale_return_line.id;
CREATE TABLE core.shop_membership (
    id integer NOT NULL,
    user_id integer NOT NULL,
    business_id integer NOT NULL,
    role character varying(20) DEFAULT 'owner'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE core.shop_membership_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.shop_membership_id_seq OWNED BY core.shop_membership.id;
CREATE TABLE core.sms_messages (
    id integer NOT NULL,
    business_id integer,
    phone_number character varying NOT NULL,
    message text NOT NULL,
    sender_id character varying,
    status core.sms_messages_status_enum DEFAULT 'sent'::core.sms_messages_status_enum NOT NULL,
    error text,
    context character varying,
    reference character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE core.sms_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.sms_messages_id_seq OWNED BY core.sms_messages.id;
CREATE TABLE core.social_post (
    id integer NOT NULL,
    kind character varying(10) NOT NULL,
    media_url character varying(500) NOT NULL,
    caption text DEFAULT ''::text NOT NULL,
    scheduled_at timestamp with time zone NOT NULL,
    status character varying(12) DEFAULT 'draft'::character varying NOT NULL,
    batch character varying(40),
    note character varying(300),
    container_id character varying(40),
    ig_media_id character varying(40),
    posted_at timestamp with time zone,
    error character varying(500),
    approved_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    account character varying(20) DEFAULT 'dukani'::character varying NOT NULL
);
CREATE SEQUENCE core.social_post_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.social_post_id_seq OWNED BY core.social_post.id;
CREATE TABLE core.subscription (
    id integer NOT NULL,
    business_id integer NOT NULL,
    plan character varying(12) NOT NULL,
    period character varying(6),
    status character varying(14) NOT NULL,
    trial_ends_at timestamp without time zone,
    paid_until timestamp without time zone,
    grace_ends_at timestamp without time zone,
    last_reminder character varying(60),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    renew_phone character varying(20),
    renew_plan character varying(12),
    renew_period character varying(6),
    renew_prompted_for character varying(10)
);
CREATE SEQUENCE core.subscription_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.subscription_id_seq OWNED BY core.subscription.id;
CREATE TABLE core.subscription_payment (
    id integer NOT NULL,
    business_id integer NOT NULL,
    receipt_number character varying(20),
    plan character varying(12) NOT NULL,
    period character varying(6) NOT NULL,
    amount numeric(12,2) NOT NULL,
    method character varying(12) DEFAULT 'manual'::character varying NOT NULL,
    reference character varying(120),
    paid_at timestamp without time zone NOT NULL,
    recorded_by_user_id integer,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE core.subscription_payment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.subscription_payment_id_seq OWNED BY core.subscription_payment.id;
CREATE TABLE core.tax (
    id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    created_by character varying(255),
    updated_by character varying(255),
    deleted boolean DEFAULT false NOT NULL,
    deleted_by character varying(255),
    active boolean DEFAULT true NOT NULL,
    action text,
    name character varying(100) NOT NULL,
    rate numeric(5,2) NOT NULL,
    description text,
    business_id integer
);
COMMENT ON COLUMN core.tax.rate IS 'Tax rate as a percentage (e.g. 7.25)';
CREATE SEQUENCE core.tax_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.tax_id_seq OWNED BY core.tax.id;
CREATE TABLE core."user" (
    id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    created_by character varying(255),
    updated_by character varying(255),
    deleted boolean DEFAULT false NOT NULL,
    deleted_by character varying(255),
    active boolean DEFAULT true NOT NULL,
    action text,
    username character varying NOT NULL,
    check_number character varying,
    password character varying(1000) NOT NULL,
    address character varying(100) NOT NULL,
    email character varying(100),
    mobile_number character varying,
    name character varying NOT NULL,
    new_account boolean DEFAULT true NOT NULL,
    is_logged_in boolean DEFAULT false NOT NULL,
    account_non_expired boolean DEFAULT false NOT NULL,
    login_attempt integer DEFAULT 0 NOT NULL,
    account_non_locked boolean DEFAULT false NOT NULL,
    credentials_non_expired boolean DEFAULT false NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    business_id integer,
    token_version integer DEFAULT 0 NOT NULL,
    signature_url character varying(500)
);
CREATE SEQUENCE core.user_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.user_id_seq OWNED BY core."user".id;
CREATE TABLE core.warehouses (
    id integer NOT NULL,
    name character varying NOT NULL,
    address character varying NOT NULL,
    city character varying,
    state character varying,
    "zipCode" character varying,
    country character varying,
    phone character varying,
    email character varying,
    "managerName" character varying,
    capacity numeric(10,2),
    "currentStock" numeric(10,2),
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    business_id integer
);
CREATE SEQUENCE core.warehouses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.warehouses_id_seq OWNED BY core.warehouses.id;
CREATE TABLE core.web_link (
    id integer NOT NULL,
    code_hash character varying(64) NOT NULL,
    user_id integer NOT NULL,
    business_id integer NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    used_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE core.web_link_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.web_link_id_seq OWNED BY core.web_link.id;
CREATE TABLE core.whatsapp_order_items (
    id integer NOT NULL,
    quantity integer NOT NULL,
    "unitPrice" numeric(10,2) NOT NULL,
    "totalPrice" numeric(12,2) NOT NULL,
    order_id integer,
    item_id integer
);
CREATE SEQUENCE core.whatsapp_order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.whatsapp_order_items_id_seq OWNED BY core.whatsapp_order_items.id;
CREATE TABLE core.whatsapp_orders (
    id integer NOT NULL,
    order_number character varying NOT NULL,
    customer_phone character varying NOT NULL,
    "totalAmount" numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    status core.whatsapp_orders_status_enum DEFAULT 'pending'::core.whatsapp_orders_status_enum NOT NULL,
    notes text,
    delivery_address text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    confirmed_at timestamp without time zone,
    delivered_at timestamp without time zone,
    customer_id integer,
    warehouse_id integer,
    rating integer,
    feedback text,
    rated_at timestamp without time zone,
    "orderSource" core.whatsapp_orders_ordersource_enum DEFAULT 'whatsapp'::core.whatsapp_orders_ordersource_enum NOT NULL,
    "paymentMethod" core.whatsapp_orders_paymentmethod_enum,
    "paymentStatus" core.whatsapp_orders_paymentstatus_enum DEFAULT 'pending'::core.whatsapp_orders_paymentstatus_enum NOT NULL,
    business_id integer,
    buyer_id integer
);
CREATE SEQUENCE core.whatsapp_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.whatsapp_orders_id_seq OWNED BY core.whatsapp_orders.id;
CREATE TABLE core.whatsapp_sessions (
    id integer NOT NULL,
    phone_number character varying NOT NULL,
    state core.whatsapp_sessions_state_enum DEFAULT 'main_menu'::core.whatsapp_sessions_state_enum NOT NULL,
    context json,
    last_message_id character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    last_cart_reminder_at timestamp without time zone,
    business_id integer
);
CREATE SEQUENCE core.whatsapp_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE core.whatsapp_sessions_id_seq OWNED BY core.whatsapp_sessions.id;
ALTER TABLE ONLY core.accounts ALTER COLUMN id SET DEFAULT nextval('core.accounts_id_seq'::regclass);
ALTER TABLE ONLY core.billing_checkout ALTER COLUMN id SET DEFAULT nextval('core.billing_checkout_id_seq'::regclass);
ALTER TABLE ONLY core.brand ALTER COLUMN id SET DEFAULT nextval('core.brand_id_seq'::regclass);
ALTER TABLE ONLY core.business ALTER COLUMN id SET DEFAULT nextval('core.business_id_seq'::regclass);
ALTER TABLE ONLY core.buyer ALTER COLUMN id SET DEFAULT nextval('core.buyer_id_seq'::regclass);
ALTER TABLE ONLY core.buyer_device ALTER COLUMN id SET DEFAULT nextval('core.buyer_device_id_seq'::regclass);
ALTER TABLE ONLY core.cash_movement ALTER COLUMN id SET DEFAULT nextval('core.cash_movement_id_seq'::regclass);
ALTER TABLE ONLY core.chat_conversation ALTER COLUMN id SET DEFAULT nextval('core.chat_conversation_id_seq'::regclass);
ALTER TABLE ONLY core.chat_message ALTER COLUMN id SET DEFAULT nextval('core.chat_message_id_seq'::regclass);
ALTER TABLE ONLY core.chat_report ALTER COLUMN id SET DEFAULT nextval('core.chat_report_id_seq'::regclass);
ALTER TABLE ONLY core.color_categories ALTER COLUMN id SET DEFAULT nextval('core.color_categories_id_seq'::regclass);
ALTER TABLE ONLY core.common ALTER COLUMN id SET DEFAULT nextval('core.common_id_seq'::regclass);
ALTER TABLE ONLY core.customer ALTER COLUMN id SET DEFAULT nextval('core.customer_id_seq'::regclass);
ALTER TABLE ONLY core.debt_payment ALTER COLUMN id SET DEFAULT nextval('core.debt_payment_id_seq'::regclass);
ALTER TABLE ONLY core.device_token ALTER COLUMN id SET DEFAULT nextval('core.device_token_id_seq'::regclass);
ALTER TABLE ONLY core.expense ALTER COLUMN id SET DEFAULT nextval('core.expense_id_seq'::regclass);
ALTER TABLE ONLY core.inventory_transactions ALTER COLUMN id SET DEFAULT nextval('core.inventory_transactions_id_seq'::regclass);
ALTER TABLE ONLY core.item ALTER COLUMN id SET DEFAULT nextval('core.item_id_seq'::regclass);
ALTER TABLE ONLY core.item_account_mapping ALTER COLUMN id SET DEFAULT nextval('core.item_account_mapping_id_seq'::regclass);
ALTER TABLE ONLY core.item_image ALTER COLUMN id SET DEFAULT nextval('core.item_image_id_seq'::regclass);
ALTER TABLE ONLY core.item_price ALTER COLUMN id SET DEFAULT nextval('core.item_price_id_seq'::regclass);
ALTER TABLE ONLY core.item_stock ALTER COLUMN id SET DEFAULT nextval('core.item_stock_id_seq'::regclass);
ALTER TABLE ONLY core.item_stock_distribution ALTER COLUMN id SET DEFAULT nextval('core.item_stock_distribution_id_seq'::regclass);
ALTER TABLE ONLY core.item_supplier ALTER COLUMN id SET DEFAULT nextval('core.item_supplier_id_seq'::regclass);
ALTER TABLE ONLY core.meta_ad_insights ALTER COLUMN id SET DEFAULT nextval('core.meta_ad_insights_id_seq'::regclass);
ALTER TABLE ONLY core.notification ALTER COLUMN id SET DEFAULT nextval('core.notification_id_seq'::regclass);
ALTER TABLE ONLY core.payment_webhook ALTER COLUMN id SET DEFAULT nextval('core.payment_webhook_id_seq'::regclass);
ALTER TABLE ONLY core.permission ALTER COLUMN id SET DEFAULT nextval('core.permission_id_seq'::regclass);
ALTER TABLE ONLY core.phone_otp ALTER COLUMN id SET DEFAULT nextval('core.phone_otp_id_seq'::regclass);
ALTER TABLE ONLY core.product_review ALTER COLUMN id SET DEFAULT nextval('core.product_review_id_seq'::regclass);
ALTER TABLE ONLY core.role ALTER COLUMN id SET DEFAULT nextval('core.role_id_seq'::regclass);
ALTER TABLE ONLY core.sale ALTER COLUMN id SET DEFAULT nextval('core.sale_id_seq'::regclass);
ALTER TABLE ONLY core.sale_receipt ALTER COLUMN id SET DEFAULT nextval('core.sale_receipt_id_seq'::regclass);
ALTER TABLE ONLY core.sale_return ALTER COLUMN id SET DEFAULT nextval('core.sale_return_id_seq'::regclass);
ALTER TABLE ONLY core.sale_return_line ALTER COLUMN id SET DEFAULT nextval('core.sale_return_line_id_seq'::regclass);
ALTER TABLE ONLY core.shop_membership ALTER COLUMN id SET DEFAULT nextval('core.shop_membership_id_seq'::regclass);
ALTER TABLE ONLY core.sms_messages ALTER COLUMN id SET DEFAULT nextval('core.sms_messages_id_seq'::regclass);
ALTER TABLE ONLY core.social_post ALTER COLUMN id SET DEFAULT nextval('core.social_post_id_seq'::regclass);
ALTER TABLE ONLY core.subscription ALTER COLUMN id SET DEFAULT nextval('core.subscription_id_seq'::regclass);
ALTER TABLE ONLY core.subscription_payment ALTER COLUMN id SET DEFAULT nextval('core.subscription_payment_id_seq'::regclass);
ALTER TABLE ONLY core.tax ALTER COLUMN id SET DEFAULT nextval('core.tax_id_seq'::regclass);
ALTER TABLE ONLY core."user" ALTER COLUMN id SET DEFAULT nextval('core.user_id_seq'::regclass);
ALTER TABLE ONLY core.warehouses ALTER COLUMN id SET DEFAULT nextval('core.warehouses_id_seq'::regclass);
ALTER TABLE ONLY core.web_link ALTER COLUMN id SET DEFAULT nextval('core.web_link_id_seq'::regclass);
ALTER TABLE ONLY core.whatsapp_order_items ALTER COLUMN id SET DEFAULT nextval('core.whatsapp_order_items_id_seq'::regclass);
ALTER TABLE ONLY core.whatsapp_orders ALTER COLUMN id SET DEFAULT nextval('core.whatsapp_orders_id_seq'::regclass);
ALTER TABLE ONLY core.whatsapp_sessions ALTER COLUMN id SET DEFAULT nextval('core.whatsapp_sessions_id_seq'::regclass);
ALTER TABLE ONLY core.buyer
    ADD CONSTRAINT "PK_0480fc3c7289846a31b8e1bc503" PRIMARY KEY (id);
ALTER TABLE ONLY core.business
    ADD CONSTRAINT "PK_0bd850da8dafab992e2e9b058e5" PRIMARY KEY (id);
ALTER TABLE ONLY core.chat_conversation
    ADD CONSTRAINT "PK_0c5b7697e69f674eb983b1e83cc" PRIMARY KEY (id);
ALTER TABLE ONLY core.role_user
    ADD CONSTRAINT "PK_0d02ac0493a7a8193048bbc7da5" PRIMARY KEY (user_id, role_id);
ALTER TABLE ONLY core.item_stock
    ADD CONSTRAINT "PK_0e322e37024a83a3ad2977b68b9" PRIMARY KEY (id);
ALTER TABLE ONLY core.debt_payment
    ADD CONSTRAINT "PK_19caadb2d938d9ccf647a8478d2" PRIMARY KEY (id);
ALTER TABLE ONLY core.sale_receipt
    ADD CONSTRAINT "PK_202e473a42e41e90c3ba11b73fe" PRIMARY KEY (id);
ALTER TABLE ONLY core.payment_webhook
    ADD CONSTRAINT "PK_2171f35dcdaf3618449fc1cc6bd" PRIMARY KEY (id);
ALTER TABLE ONLY core.subscription_payment
    ADD CONSTRAINT "PK_25f8afce4159ee83cf8c6da622d" PRIMARY KEY (id);
ALTER TABLE ONLY core.tax
    ADD CONSTRAINT "PK_2c1e62c595571139e2fb0e9c319" PRIMARY KEY (id);
ALTER TABLE ONLY core.social_post
    ADD CONSTRAINT "PK_33f77d83d5d8e1db11c99c5c3f3" PRIMARY KEY (id);
ALTER TABLE ONLY core.permission
    ADD CONSTRAINT "PK_3b8b97af9d9d8807e41e6f48362" PRIMARY KEY (id);
ALTER TABLE ONLY core.chat_message
    ADD CONSTRAINT "PK_3cc0d85193aade457d3077dd06b" PRIMARY KEY (id);
ALTER TABLE ONLY core.whatsapp_sessions
    ADD CONSTRAINT "PK_3d45009c99e71c709c8587ae4d6" PRIMARY KEY (id);
ALTER TABLE ONLY core.warehouses
    ADD CONSTRAINT "PK_56ae21ee2432b2270b48867e4be" PRIMARY KEY (id);
ALTER TABLE ONLY core.device_token
    ADD CONSTRAINT "PK_592ce89b9ea1a268d6140f60422" PRIMARY KEY (id);
ALTER TABLE ONLY core.accounts
    ADD CONSTRAINT "PK_5a7a02c20412299d198e097a8fe" PRIMARY KEY (id);
ALTER TABLE ONLY core.item_stock_distribution
    ADD CONSTRAINT "PK_617ab22fae56d2044ff510f1001" PRIMARY KEY (id);
ALTER TABLE ONLY core.item_account_mapping
    ADD CONSTRAINT "PK_63bd3ad47bdc84eca8ebdac7071" PRIMARY KEY (id);
ALTER TABLE ONLY core.item_image
    ADD CONSTRAINT "PK_6530fd4d0bbd05681b883bd63f2" PRIMARY KEY (id);
ALTER TABLE ONLY core.cash_movement
    ADD CONSTRAINT "PK_66bd739ff97dd3242e7d53a2780" PRIMARY KEY (id);
ALTER TABLE ONLY core.phone_otp
    ADD CONSTRAINT "PK_6ba9e3a6f3c60938d59b8ac7f7a" PRIMARY KEY (id);
ALTER TABLE ONLY core.product_review
    ADD CONSTRAINT "PK_6c00bd3bbee662e1f7a97dbce9a" PRIMARY KEY (id);
ALTER TABLE ONLY core.sms_messages
    ADD CONSTRAINT "PK_6d4cfef86e93e3fde23954d11bc" PRIMARY KEY (id);
ALTER TABLE ONLY core.buyer_device
    ADD CONSTRAINT "PK_6f5878a3bc2f7b444417564911d" PRIMARY KEY (id);
ALTER TABLE ONLY core.notification
    ADD CONSTRAINT "PK_705b6c7cdf9b2c2ff7ac7872cb7" PRIMARY KEY (id);
ALTER TABLE ONLY core.whatsapp_orders
    ADD CONSTRAINT "PK_765c646950d962b4bc94bd8a6b4" PRIMARY KEY (id);
ALTER TABLE ONLY core.item_supplier
    ADD CONSTRAINT "PK_87edc67258dd99694d99e2b57bb" PRIMARY KEY (id);
ALTER TABLE ONLY core.subscription
    ADD CONSTRAINT "PK_8c3e00ebd02103caa1174cd5d9d" PRIMARY KEY (id);
ALTER TABLE ONLY core.meta_ad_insights
    ADD CONSTRAINT "PK_9a0fc92931eed414b18e75624c0" PRIMARY KEY (id);
ALTER TABLE ONLY core.inventory_transactions
    ADD CONSTRAINT "PK_9b7144851f08f9eededde7edd42" PRIMARY KEY (id);
ALTER TABLE ONLY core.sale_return_line
    ADD CONSTRAINT "PK_9ba125b4e19a2565562ef35a045" PRIMARY KEY (id);
ALTER TABLE ONLY core.brand
    ADD CONSTRAINT "PK_a5d20765ddd942eb5de4eee2d7f" PRIMARY KEY (id);
ALTER TABLE ONLY core.customer
    ADD CONSTRAINT "PK_a7a13f4cacb744524e44dfdad32" PRIMARY KEY (id);
ALTER TABLE ONLY core.role
    ADD CONSTRAINT "PK_b36bcfe02fc8de3c57a8b2391c2" PRIMARY KEY (id);
ALTER TABLE ONLY core.color_categories
    ADD CONSTRAINT "PK_b7351b747d1e94683e95c4aeb5e" PRIMARY KEY (id);
ALTER TABLE ONLY core.role_permissions_permission
    ADD CONSTRAINT "PK_b817d7eca3b85f22130861259dd" PRIMARY KEY ("roleId", "permissionId");
ALTER TABLE ONLY core.item_price
    ADD CONSTRAINT "PK_bf831a4a3a9eca20d4ef2322d7d" PRIMARY KEY (id);
ALTER TABLE ONLY core."user"
    ADD CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY (id);
ALTER TABLE ONLY core.sale
    ADD CONSTRAINT "PK_d03891c457cbcd22974732b5de2" PRIMARY KEY (id);
ALTER TABLE ONLY core.web_link
    ADD CONSTRAINT "PK_d3b37bfacd73aa2af64244791c7" PRIMARY KEY (id);
ALTER TABLE ONLY core.item
    ADD CONSTRAINT "PK_d3c0c71f23e7adcf952a1d13423" PRIMARY KEY (id);
ALTER TABLE ONLY core.billing_checkout
    ADD CONSTRAINT "PK_df3591d71a1979b6caa5616ae7d" PRIMARY KEY (id);
ALTER TABLE ONLY core.shop_membership
    ADD CONSTRAINT "PK_e39837de0ad34ff7a334ed9b72e" PRIMARY KEY (id);
ALTER TABLE ONLY core.whatsapp_order_items
    ADD CONSTRAINT "PK_e5b97482a870d27025d8d2df659" PRIMARY KEY (id);
ALTER TABLE ONLY core.chat_report
    ADD CONSTRAINT "PK_ebb459eb4da2a5061ff8d6e415e" PRIMARY KEY (id);
ALTER TABLE ONLY core.common
    ADD CONSTRAINT "PK_ec282143cf7827d43dfe99b9af1" PRIMARY KEY (id);
ALTER TABLE ONLY core.expense
    ADD CONSTRAINT "PK_edd925b450e13ea36197c9590fc" PRIMARY KEY (id);
ALTER TABLE ONLY core.sale_return
    ADD CONSTRAINT "PK_f6d393bd608c19feb605cc97dc0" PRIMARY KEY (id);
ALTER TABLE ONLY core.buyer
    ADD CONSTRAINT "UQ_03c394262a6e2279f7002a8fa16" UNIQUE (phone);
ALTER TABLE ONLY core.billing_checkout
    ADD CONSTRAINT "UQ_1063e5173deab53643fc9280ac2" UNIQUE (order_id);
ALTER TABLE ONLY core.item
    ADD CONSTRAINT "UQ_16c6af7e42d4bad673c368621c2" UNIQUE (code, business_id);
ALTER TABLE ONLY core.color_categories
    ADD CONSTRAINT "UQ_4767bafd51c497e9281a161a423" UNIQUE (name, business_id);
ALTER TABLE ONLY core.product_review
    ADD CONSTRAINT "UQ_4b8b69b9af6c3d5af9edc614e57" UNIQUE (order_id, item_id);
ALTER TABLE ONLY core."user"
    ADD CONSTRAINT "UQ_78a916df40e02a9deb1c4b75edb" UNIQUE (username);
ALTER TABLE ONLY core.business
    ADD CONSTRAINT "UQ_84a9cab71052a72adadf392d14e" UNIQUE (slug);
ALTER TABLE ONLY core.buyer_device
    ADD CONSTRAINT "UQ_b094983386145562d5719f992a7" UNIQUE (token);
ALTER TABLE ONLY core.brand
    ADD CONSTRAINT "UQ_b56afad93f1a9519818a26550ba" UNIQUE (name, business_id);
ALTER TABLE ONLY core.subscription
    ADD CONSTRAINT "UQ_bc6dcc3ba8bb22b61d71cdc214d" UNIQUE (business_id);
ALTER TABLE ONLY core.warehouses
    ADD CONSTRAINT "UQ_d2eb753c64d68ebaa6a0f1e4d18" UNIQUE (name, business_id);
ALTER TABLE ONLY core.device_token
    ADD CONSTRAINT "UQ_d959c11311d3002e4bb10d9edbd" UNIQUE (token);
ALTER TABLE ONLY core.whatsapp_orders
    ADD CONSTRAINT "UQ_ed4b605a608a6c6be0ec1d98d00" UNIQUE (order_number, business_id);
ALTER TABLE ONLY core.customer
    ADD CONSTRAINT "UQ_ed790abd3f7016518547b38f9ee" UNIQUE (phone, business_id);
ALTER TABLE ONLY core.meta_ad_insights
    ADD CONSTRAINT "UQ_ee39e894dcd96144198695b0221" UNIQUE (campaign_id, ad_id, date, business_id);
ALTER TABLE ONLY core.whatsapp_sessions
    ADD CONSTRAINT "UQ_f8c6fbe45a80abcd6b893c5b5ec" UNIQUE (phone_number, business_id);
ALTER TABLE ONLY core.item_stock
    ADD CONSTRAINT uq_item_stock_item_warehouse UNIQUE ("itemId", "warehouseId");
ALTER TABLE ONLY core.notification
    ADD CONSTRAINT uq_notification_key UNIQUE (business_id, dedupe_key);
CREATE INDEX "IDX_052ab359d907d2354684fd847c" ON core.cash_movement USING btree (business_id, occurred_at);
CREATE INDEX "IDX_137ef9698a49c48e15ae675c2a" ON core.color_categories USING btree (business_id);
CREATE INDEX "IDX_16c2c962c5607b82778b8e3f70" ON core.product_review USING btree (business_id);
CREATE INDEX "IDX_1731022216385244de04dbcff5" ON core.sms_messages USING btree (reference);
CREATE INDEX "IDX_1e8d65c24d10be1ed6b5817fa3" ON core.sale_return USING btree (business_id, receipt_id);
CREATE INDEX "IDX_244c3b629c3785bf3cb89895be" ON core.whatsapp_sessions USING btree (business_id);
CREATE INDEX "IDX_2a473f82190ecb5de619f32b6d" ON core.warehouses USING btree (business_id);
CREATE INDEX "IDX_32b7e60d57fd99f9678f723fe5" ON core.item USING btree (business_id);
CREATE INDEX "IDX_3540eff1d0d8d3352ade36ebf2" ON core.brand USING btree (business_id);
CREATE INDEX "IDX_3a121eb128d1003c89eab7a5bd" ON core.notification USING btree (business_id, created_at);
CREATE UNIQUE INDEX "IDX_3c4caff841588278cf97503e58" ON core.web_link USING btree (code_hash);
CREATE INDEX "IDX_3f8883f1d6463fd0033877c69d" ON core.whatsapp_orders USING btree (business_id);
CREATE INDEX "IDX_4069af55d52c3810dbc6c619a5" ON core.billing_checkout USING btree (business_id, created_at);
CREATE INDEX "IDX_40dfd40d6a48aa07d46fc73d73" ON core.inventory_transactions USING btree (business_id);
CREATE INDEX "IDX_434c273c97e45d0ee1108458cf" ON core.debt_payment USING btree (receipt_id);
CREATE INDEX "IDX_4646d80ec7ecffc1e6028b3f08" ON core.meta_ad_insights USING btree (date);
CREATE INDEX "IDX_5261e26da61ccaf8aeda8bca8e" ON core.role_user USING btree (user_id);
CREATE INDEX "IDX_54b2e5baf59f41909a9bcf26d1" ON core.meta_ad_insights USING btree (business_id);
CREATE INDEX "IDX_558ef816f45e40682ef5a0528a" ON core.social_post USING btree (status, scheduled_at);
CREATE INDEX "IDX_5a4bd96d9a519d4d20a21231b9" ON core."user" USING btree (business_id);
CREATE INDEX "IDX_5bd4dcaf7f936b72cf03f1e773" ON core.accounts USING btree (business_id);
CREATE INDEX "IDX_5d52b5767828bb4f0714ffd188" ON core.subscription_payment USING btree (business_id);
CREATE INDEX "IDX_64c1cf2e641b29ff930d45afeb" ON core.item_supplier USING btree (business_id);
CREATE INDEX "IDX_6af2a8e8a25b87774bc871769c" ON core.debt_payment USING btree (business_id, customer_id);
CREATE UNIQUE INDEX "IDX_6daf8ad96014fe6c224bf080d9" ON core.chat_conversation USING btree (business_id, buyer_id);
CREATE INDEX "IDX_6db098c9afc425ff5e9d5bac78" ON core.product_review USING btree (item_id);
CREATE INDEX "IDX_6ef77e7d8f91815b549cb2cab0" ON core.device_token USING btree (business_id);
CREATE INDEX "IDX_78e2540d927444265b0b220825" ON core.payment_webhook USING btree (order_reference);
CREATE INDEX "IDX_78ee37f2db349d230d502b1c7e" ON core.role_user USING btree (role_id);
CREATE INDEX "IDX_81380b8443f6f2c90af4998650" ON core.sale USING btree (business_id);
CREATE INDEX "IDX_845aadb1d7fedcab85fd46496f" ON core.common USING btree (business_id);
CREATE INDEX "IDX_8a962a430dcb482cb7561af7bf" ON core.sms_messages USING btree (phone_number);
CREATE INDEX "IDX_99edfc708367149f69e2671c35" ON core.cash_movement USING btree (business_id);
CREATE INDEX "IDX_9b5360ac4c4aa80f98572a11e5" ON core.chat_conversation USING btree (business_id, last_message_at);
CREATE INDEX "IDX_9ca98deab5f4c69b8e7f766544" ON core.customer USING btree (business_id);
CREATE INDEX "IDX_a3adceb03b8b25ca57172d41f2" ON core.billing_checkout USING btree (status);
CREATE INDEX "IDX_aec68586261792f96da35ff358" ON core.item_image USING btree (item_id);
CREATE INDEX "IDX_b36cb2e04bc353ca4ede00d87b" ON core.role_permissions_permission USING btree ("roleId");
CREATE INDEX "IDX_b407da382bb5b53e8dc611ffe0" ON core.chat_conversation USING btree (buyer_id, last_message_at);
CREATE INDEX "IDX_b71a4cd251dab7919ff8a50afe" ON core.whatsapp_orders USING btree (buyer_id);
CREATE INDEX "IDX_bfbc9e263d4cea6d7a8c9eb3ad" ON core.role_permissions_permission USING btree ("permissionId");
CREATE INDEX "IDX_c9ccf9ca1be197143b5ba30a0e" ON core.chat_message USING btree (conversation_id, id);
CREATE INDEX "IDX_cbe551e698999ca1b5f24bd368" ON core.sms_messages USING btree (business_id);
CREATE UNIQUE INDEX "IDX_cf1dcb7e72ff0e55d0a1a1d5ad" ON core.shop_membership USING btree (user_id, business_id);
CREATE INDEX "IDX_d24b17fc6903c918ea1d0d4c64" ON core.phone_otp USING btree (phone, purpose, "consumedAt");
CREATE INDEX "IDX_d4d1c5f20573ab76988b8cdb37" ON core.sale_receipt USING btree (business_id, created_at);
CREATE INDEX "IDX_d7a8ea4cd7366cb550a97f8863" ON core.tax USING btree (business_id);
CREATE INDEX "IDX_f3590f9f3b52f5e4cceb323d86" ON core.expense USING btree (business_id);
CREATE UNIQUE INDEX uq_receipt_client_ref ON core.sale_receipt USING btree (business_id, client_ref) WHERE (client_ref IS NOT NULL);
ALTER TABLE ONLY core.inventory_transactions
    ADD CONSTRAINT "FK_073259120ddd23357a88f7cd113" FOREIGN KEY (item_id) REFERENCES core.item(id);
ALTER TABLE ONLY core.item_stock_distribution
    ADD CONSTRAINT "FK_07f40dfa5c8797642a601f90c93" FOREIGN KEY ("colorCategoryId") REFERENCES core.color_categories(id);
ALTER TABLE ONLY core.item_stock
    ADD CONSTRAINT "FK_0d79016c1c735154c0adbc6beae" FOREIGN KEY ("warehouseId") REFERENCES core.warehouses(id);
ALTER TABLE ONLY core.item_stock
    ADD CONSTRAINT "FK_1350c1885acfc5075f627558c1b" FOREIGN KEY ("itemId") REFERENCES core.item(id);
ALTER TABLE ONLY core.color_categories
    ADD CONSTRAINT "FK_137ef9698a49c48e15ae675c2ac" FOREIGN KEY (business_id) REFERENCES core.business(id);
ALTER TABLE ONLY core.item_account_mapping
    ADD CONSTRAINT "FK_16bcaf5ce87863b53498f8d7660" FOREIGN KEY (sale_account_id) REFERENCES core.accounts(id);
ALTER TABLE ONLY core.sale
    ADD CONSTRAINT "FK_202e473a42e41e90c3ba11b73fe" FOREIGN KEY (receipt_id) REFERENCES core.sale_receipt(id) ON DELETE SET NULL;
ALTER TABLE ONLY core.item_account_mapping
    ADD CONSTRAINT "FK_216db0c29bf7979425b01416334" FOREIGN KEY ("itemId") REFERENCES core.item(id);
ALTER TABLE ONLY core.whatsapp_sessions
    ADD CONSTRAINT "FK_244c3b629c3785bf3cb89895be3" FOREIGN KEY (business_id) REFERENCES core.business(id);
ALTER TABLE ONLY core.accounts
    ADD CONSTRAINT "FK_282211e77a5b8c51870560c90ae" FOREIGN KEY ("codeId") REFERENCES core.common(id);
ALTER TABLE ONLY core.warehouses
    ADD CONSTRAINT "FK_2a473f82190ecb5de619f32b6d9" FOREIGN KEY (business_id) REFERENCES core.business(id);
ALTER TABLE ONLY core.item
    ADD CONSTRAINT "FK_32b7e60d57fd99f9678f723fe56" FOREIGN KEY (business_id) REFERENCES core.business(id);
ALTER TABLE ONLY core.brand
    ADD CONSTRAINT "FK_3540eff1d0d8d3352ade36ebf2d" FOREIGN KEY (business_id) REFERENCES core.business(id);
ALTER TABLE ONLY core.whatsapp_order_items
    ADD CONSTRAINT "FK_3d7c2d80eed94574e17717eb393" FOREIGN KEY (item_id) REFERENCES core.item(id);
ALTER TABLE ONLY core.whatsapp_orders
    ADD CONSTRAINT "FK_3f8883f1d6463fd0033877c69d3" FOREIGN KEY (business_id) REFERENCES core.business(id);
ALTER TABLE ONLY core.inventory_transactions
    ADD CONSTRAINT "FK_40dfd40d6a48aa07d46fc73d733" FOREIGN KEY (business_id) REFERENCES core.business(id);
ALTER TABLE ONLY core.sale
    ADD CONSTRAINT "FK_439a57a4a0d130329d3d2e671b6" FOREIGN KEY (item_id) REFERENCES core.item(id);
ALTER TABLE ONLY core.whatsapp_order_items
    ADD CONSTRAINT "FK_4ea429870ea12d81692033a3491" FOREIGN KEY (order_id) REFERENCES core.whatsapp_orders(id);
ALTER TABLE ONLY core.role_user
    ADD CONSTRAINT "FK_5261e26da61ccaf8aeda8bca8ea" FOREIGN KEY (user_id) REFERENCES core."user"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY core.meta_ad_insights
    ADD CONSTRAINT "FK_54b2e5baf59f41909a9bcf26d18" FOREIGN KEY (business_id) REFERENCES core.business(id);
ALTER TABLE ONLY core.item
    ADD CONSTRAINT "FK_59e14a7b9bb9d455f362334fdee" FOREIGN KEY ("warehouseId") REFERENCES core.warehouses(id);
ALTER TABLE ONLY core."user"
    ADD CONSTRAINT "FK_5a4bd96d9a519d4d20a21231b9f" FOREIGN KEY (business_id) REFERENCES core.business(id);
ALTER TABLE ONLY core.accounts
    ADD CONSTRAINT "FK_5bd4dcaf7f936b72cf03f1e773c" FOREIGN KEY (business_id) REFERENCES core.business(id);
ALTER TABLE ONLY core.accounts
    ADD CONSTRAINT "FK_6452d7ea828485225895d79cd8e" FOREIGN KEY ("typeId") REFERENCES core.common(id);
ALTER TABLE ONLY core.item_supplier
    ADD CONSTRAINT "FK_64c1cf2e641b29ff930d45afebf" FOREIGN KEY (business_id) REFERENCES core.business(id);
ALTER TABLE ONLY core.product_review
    ADD CONSTRAINT "FK_6db098c9afc425ff5e9d5bac788" FOREIGN KEY (item_id) REFERENCES core.item(id) ON DELETE CASCADE;
ALTER TABLE ONLY core.sale_receipt
    ADD CONSTRAINT "FK_6e830f286fde4fed86884ce663d" FOREIGN KEY (warehouse_id) REFERENCES core.warehouses(id);
ALTER TABLE ONLY core.product_review
    ADD CONSTRAINT "FK_72bebe79c74646c24a7f336f758" FOREIGN KEY (order_id) REFERENCES core.whatsapp_orders(id) ON DELETE CASCADE;
ALTER TABLE ONLY core.role_user
    ADD CONSTRAINT "FK_78ee37f2db349d230d502b1c7ea" FOREIGN KEY (role_id) REFERENCES core.role(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY core.sale
    ADD CONSTRAINT "FK_81380b8443f6f2c90af49986507" FOREIGN KEY (business_id) REFERENCES core.business(id);
ALTER TABLE ONLY core.accounts
    ADD CONSTRAINT "FK_82655922433e50df4fd451d5240" FOREIGN KEY (parent_account_id) REFERENCES core.accounts(id);
ALTER TABLE ONLY core.common
    ADD CONSTRAINT "FK_845aadb1d7fedcab85fd46496fc" FOREIGN KEY (business_id) REFERENCES core.business(id);
ALTER TABLE ONLY core.item_account_mapping
    ADD CONSTRAINT "FK_86c7f6d67dd611120ab9e6c0eb8" FOREIGN KEY (inventory_account_id) REFERENCES core.accounts(id);
ALTER TABLE ONLY core.sale
    ADD CONSTRAINT "FK_89809b48d46cc3eae0565c016e4" FOREIGN KEY (customer_id) REFERENCES core.customer(id);
ALTER TABLE ONLY core.sale_return_line
    ADD CONSTRAINT "FK_8b86dd3ff96dcd94128c4643748" FOREIGN KEY (return_id) REFERENCES core.sale_return(id) ON DELETE CASCADE;
ALTER TABLE ONLY core.common
    ADD CONSTRAINT "FK_981492395d6af1596561b4387a8" FOREIGN KEY ("parentCategoryId") REFERENCES core.common(id);
ALTER TABLE ONLY core.cash_movement
    ADD CONSTRAINT "FK_99edfc708367149f69e2671c352" FOREIGN KEY (business_id) REFERENCES core.business(id);
ALTER TABLE ONLY core.customer
    ADD CONSTRAINT "FK_9ca98deab5f4c69b8e7f7665444" FOREIGN KEY (business_id) REFERENCES core.business(id);
ALTER TABLE ONLY core.item_account_mapping
    ADD CONSTRAINT "FK_9d25290bfe2695eb676ea498783" FOREIGN KEY (cogs_account_id) REFERENCES core.accounts(id);
ALTER TABLE ONLY core.item
    ADD CONSTRAINT "FK_9e2a16fa67338b5d7ba015b4e98" FOREIGN KEY ("brandId") REFERENCES core.brand(id);
ALTER TABLE ONLY core.item_stock_distribution
    ADD CONSTRAINT "FK_a6d242c8ababfa58d0a9288fb9a" FOREIGN KEY ("itemStockId") REFERENCES core.item_stock(id);
ALTER TABLE ONLY core.business
    ADD CONSTRAINT "FK_a8c4f2a15b5d089c9a6a771c4fc" FOREIGN KEY ("categoryId") REFERENCES core.common(id);
ALTER TABLE ONLY core.item_image
    ADD CONSTRAINT "FK_aec68586261792f96da35ff358e" FOREIGN KEY (item_id) REFERENCES core.item(id) ON DELETE CASCADE;
ALTER TABLE ONLY core.whatsapp_orders
    ADD CONSTRAINT "FK_af6f250a1610e0c51df54771e48" FOREIGN KEY (warehouse_id) REFERENCES core.warehouses(id);
ALTER TABLE ONLY core.whatsapp_orders
    ADD CONSTRAINT "FK_b2d46594ab39abc1a76be4f1abc" FOREIGN KEY (customer_id) REFERENCES core.customer(id);
ALTER TABLE ONLY core.role_permissions_permission
    ADD CONSTRAINT "FK_b36cb2e04bc353ca4ede00d87b9" FOREIGN KEY ("roleId") REFERENCES core.role(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY core.item
    ADD CONSTRAINT "FK_bd48da54281b181e4de3546b413" FOREIGN KEY ("subcategoryId") REFERENCES core.common(id);
ALTER TABLE ONLY core.sale
    ADD CONSTRAINT "FK_bdf51d626fa9482d6c9a62c1c9d" FOREIGN KEY (warehouse_id) REFERENCES core.warehouses(id);
ALTER TABLE ONLY core.role_permissions_permission
    ADD CONSTRAINT "FK_bfbc9e263d4cea6d7a8c9eb3ad2" FOREIGN KEY ("permissionId") REFERENCES core.permission(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY core.item
    ADD CONSTRAINT "FK_c0c8f47a702c974a77812169bc2" FOREIGN KEY ("categoryId") REFERENCES core.common(id);
ALTER TABLE ONLY core.sms_messages
    ADD CONSTRAINT "FK_cbe551e698999ca1b5f24bd3686" FOREIGN KEY (business_id) REFERENCES core.business(id);
ALTER TABLE ONLY core.tax
    ADD CONSTRAINT "FK_d7a8ea4cd7366cb550a97f88632" FOREIGN KEY (business_id) REFERENCES core.business(id);
ALTER TABLE ONLY core.item
    ADD CONSTRAINT "FK_e7c44eae41483213a380f4c57c5" FOREIGN KEY ("supplierId") REFERENCES core.item_supplier(id);
ALTER TABLE ONLY core.sale_receipt
    ADD CONSTRAINT "FK_eb0ebc0aa22a869cdce021a0b4c" FOREIGN KEY (customer_id) REFERENCES core.customer(id);
ALTER TABLE ONLY core.expense
    ADD CONSTRAINT "FK_f3590f9f3b52f5e4cceb323d86b" FOREIGN KEY (business_id) REFERENCES core.business(id);
ALTER TABLE ONLY core.item_price
    ADD CONSTRAINT "FK_f8046453707754686bb1775ef71" FOREIGN KEY ("itemId") REFERENCES core.item(id);
