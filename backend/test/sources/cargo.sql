CREATE TABLE public.consignments (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    mode character varying(3) NOT NULL,
    ref character varying(40) NOT NULL,
    detail character varying(60) DEFAULT ''::character varying NOT NULL,
    route character varying(120) DEFAULT 'Guangzhou → Dar es Salaam'::character varying NOT NULL,
    status character varying(20) DEFAULT 'loading'::character varying NOT NULL,
    eta date,
    "capacityCbm" numeric(8,2),
    "capacityKg" numeric(10,2),
    "departedAt" timestamp with time zone,
    "arrivedAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE public.consignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.consignments_id_seq OWNED BY public.consignments.id;
CREATE TABLE public.customers (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    code character varying(20) NOT NULL,
    name character varying NOT NULL,
    phone character varying(20) NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    "seaRate" numeric(10,2),
    "airRate" numeric(10,2),
    active boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE public.customers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.customers_id_seq OWNED BY public.customers.id;
CREATE TABLE public.lockouts (
    key character varying(80) NOT NULL,
    failures integer DEFAULT 0 NOT NULL,
    "lastFailureAt" timestamp with time zone,
    "lockedUntil" timestamp with time zone
);
CREATE TABLE public.message_log (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "customerId" integer,
    "to" character varying(20) NOT NULL,
    channel character varying(10) NOT NULL,
    template character varying(20) NOT NULL,
    ref character varying(40) DEFAULT ''::character varying NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    status character varying(10) NOT NULL,
    "providerId" character varying(120),
    error text,
    "retryOfId" integer,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE public.message_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.message_log_id_seq OWNED BY public.message_log.id;
CREATE TABLE public.message_templates (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    key character varying(20) NOT NULL,
    whatsapp boolean NOT NULL,
    sms boolean NOT NULL,
    body text NOT NULL
);
CREATE SEQUENCE public.message_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.message_templates_id_seq OWNED BY public.message_templates.id;
CREATE TABLE public.migrations (
    id integer NOT NULL,
    "timestamp" bigint NOT NULL,
    name character varying NOT NULL
);
CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;
CREATE TABLE public.otp_codes (
    id integer NOT NULL,
    phone character varying(20) NOT NULL,
    purpose character varying(40) NOT NULL,
    "codeHash" character varying(64) NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    "consumedAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE public.otp_codes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.otp_codes_id_seq OWNED BY public.otp_codes.id;
CREATE TABLE public.payments (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "customerId" integer NOT NULL,
    "receiptNo" character varying(20),
    method character varying(10) NOT NULL,
    "amountTzs" bigint NOT NULL,
    status character varying(10) DEFAULT 'pending'::character varying NOT NULL,
    reference character varying(120) DEFAULT ''::character varying NOT NULL,
    "shipmentIds" integer[] DEFAULT '{}'::integer[] NOT NULL,
    allocations jsonb DEFAULT '[]'::jsonb NOT NULL,
    "unappliedTzs" bigint DEFAULT '0'::bigint NOT NULL,
    provider character varying(10) DEFAULT 'manual'::character varying NOT NULL,
    "orderId" character varying(40),
    "payerPhone" character varying(20),
    "byUserId" integer,
    "failureReason" character varying(300),
    "paidAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE public.payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.payments_id_seq OWNED BY public.payments.id;
CREATE TABLE public.photos (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    kind character varying(10) NOT NULL,
    "shipmentId" integer,
    "releaseId" integer,
    path character varying NOT NULL,
    mime character varying(20) NOT NULL,
    bytes integer NOT NULL,
    "byUserId" integer,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE public.photos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.photos_id_seq OWNED BY public.photos.id;
CREATE TABLE public.releases (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    number character varying(20) NOT NULL,
    "customerId" integer NOT NULL,
    "shipmentIds" integer[] NOT NULL,
    "collectorSelf" boolean NOT NULL,
    "collectorName" character varying NOT NULL,
    "collectorPhone" character varying(20),
    "collectorIdNo" character varying(40),
    "verifiedBy" character varying(10) NOT NULL,
    "overrideReason" character varying(300),
    "creditTzs" bigint DEFAULT '0'::bigint NOT NULL,
    "byUserId" integer NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE public.releases_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.releases_id_seq OWNED BY public.releases.id;
CREATE TABLE public.shipment_events (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    "shipmentId" integer NOT NULL,
    status character varying(20) NOT NULL,
    note character varying(300) NOT NULL,
    "byUserId" integer,
    at timestamp with time zone NOT NULL
);
CREATE SEQUENCE public.shipment_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.shipment_events_id_seq OWNED BY public.shipment_events.id;
CREATE TABLE public.shipments (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    number character varying(20) NOT NULL,
    "customerId" integer,
    "rawCode" character varying(40) NOT NULL,
    "warehouseId" integer NOT NULL,
    mode character varying(3) NOT NULL,
    goods character varying(200) NOT NULL,
    "goodsType" character varying(10) DEFAULT 'normal'::character varying NOT NULL,
    boxes jsonb NOT NULL,
    "boxCount" integer NOT NULL,
    "weightKg" numeric(10,2) NOT NULL,
    cbm numeric(10,3) NOT NULL,
    "chargeableKg" numeric(10,2) NOT NULL,
    "estimateUsd" numeric(12,2) NOT NULL,
    "chargeUsd" numeric(12,2),
    "fxRate" numeric(10,2),
    "paidTzs" bigint DEFAULT '0'::bigint NOT NULL,
    status character varying(20) DEFAULT 'received'::character varying NOT NULL,
    "consignmentId" integer,
    "releaseId" integer,
    "trackingToken" character varying(16) NOT NULL,
    "receivedById" integer,
    "receivedAt" timestamp with time zone NOT NULL,
    "invoicedAt" timestamp with time zone,
    "readyAt" timestamp with time zone,
    "collectedAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "clientRef" character varying(64)
);
CREATE SEQUENCE public.shipments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.shipments_id_seq OWNED BY public.shipments.id;
CREATE TABLE public.tenants (
    id integer NOT NULL,
    name character varying NOT NULL,
    "shortName" character varying(40) NOT NULL,
    slug character varying(40) NOT NULL,
    "codePrefix" character varying(6) NOT NULL,
    phone character varying(20) NOT NULL,
    whatsapp character varying(20),
    location character varying(120) DEFAULT 'Dar es Salaam'::character varying NOT NULL,
    "fxRate" numeric(10,2) DEFAULT '2520'::numeric NOT NULL,
    rates jsonb DEFAULT '{}'::jsonb NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    plan character varying(20) DEFAULT 'trial'::character varying NOT NULL,
    "trialEndsAt" timestamp with time zone,
    "selcomSecret" text,
    "selcomVendor" character varying(40),
    "lastCustomerNo" integer DEFAULT 0 NOT NULL,
    "lastShipmentNo" integer DEFAULT 0 NOT NULL,
    "lastReleaseNo" integer DEFAULT 0 NOT NULL,
    "lastReceiptNo" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "isDemo" boolean DEFAULT false NOT NULL
);
CREATE SEQUENCE public.tenants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.tenants_id_seq OWNED BY public.tenants.id;
CREATE TABLE public.users (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    name character varying NOT NULL,
    phone character varying(20) NOT NULL,
    role character varying(20) NOT NULL,
    "warehouseId" integer,
    "passwordHash" character varying NOT NULL,
    "mustChangePassword" boolean DEFAULT false NOT NULL,
    active boolean DEFAULT true NOT NULL,
    "tokenVersion" integer DEFAULT 0 NOT NULL,
    "lastLoginAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;
CREATE TABLE public.warehouses (
    id integer NOT NULL,
    "tenantId" integer NOT NULL,
    name character varying NOT NULL,
    country character varying(2) NOT NULL,
    address text DEFAULT ''::text NOT NULL,
    "addressLocal" text DEFAULT ''::text NOT NULL,
    contact character varying(120) DEFAULT ''::character varying NOT NULL,
    active boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE public.warehouses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.warehouses_id_seq OWNED BY public.warehouses.id;
ALTER TABLE ONLY public.consignments ALTER COLUMN id SET DEFAULT nextval('public.consignments_id_seq'::regclass);
ALTER TABLE ONLY public.customers ALTER COLUMN id SET DEFAULT nextval('public.customers_id_seq'::regclass);
ALTER TABLE ONLY public.message_log ALTER COLUMN id SET DEFAULT nextval('public.message_log_id_seq'::regclass);
ALTER TABLE ONLY public.message_templates ALTER COLUMN id SET DEFAULT nextval('public.message_templates_id_seq'::regclass);
ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);
ALTER TABLE ONLY public.otp_codes ALTER COLUMN id SET DEFAULT nextval('public.otp_codes_id_seq'::regclass);
ALTER TABLE ONLY public.payments ALTER COLUMN id SET DEFAULT nextval('public.payments_id_seq'::regclass);
ALTER TABLE ONLY public.photos ALTER COLUMN id SET DEFAULT nextval('public.photos_id_seq'::regclass);
ALTER TABLE ONLY public.releases ALTER COLUMN id SET DEFAULT nextval('public.releases_id_seq'::regclass);
ALTER TABLE ONLY public.shipment_events ALTER COLUMN id SET DEFAULT nextval('public.shipment_events_id_seq'::regclass);
ALTER TABLE ONLY public.shipments ALTER COLUMN id SET DEFAULT nextval('public.shipments_id_seq'::regclass);
ALTER TABLE ONLY public.tenants ALTER COLUMN id SET DEFAULT nextval('public.tenants_id_seq'::regclass);
ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);
ALTER TABLE ONLY public.warehouses ALTER COLUMN id SET DEFAULT nextval('public.warehouses_id_seq'::regclass);
ALTER TABLE ONLY public.customers
    ADD CONSTRAINT "PK_133ec679a801fab5e070f73d3ea" PRIMARY KEY (id);
ALTER TABLE ONLY public.payments
    ADD CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY (id);
ALTER TABLE ONLY public.photos
    ADD CONSTRAINT "PK_5220c45b8e32d49d767b9b3d725" PRIMARY KEY (id);
ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT "PK_53be67a04681c66b87ee27c9321" PRIMARY KEY (id);
ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT "PK_56ae21ee2432b2270b48867e4be" PRIMARY KEY (id);
ALTER TABLE ONLY public.releases
    ADD CONSTRAINT "PK_6b6fc2599a5a281dd44a7d64016" PRIMARY KEY (id);
ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT "PK_6deda4532ac542a93eab214b564" PRIMARY KEY (id);
ALTER TABLE ONLY public.shipment_events
    ADD CONSTRAINT "PK_80a42a8d00d59cbfab38e1d0872" PRIMARY KEY (id);
ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT "PK_8c82d7f526340ab734260ea46be" PRIMARY KEY (id);
ALTER TABLE ONLY public.message_templates
    ADD CONSTRAINT "PK_9ac2bd9635be662d183f314947d" PRIMARY KEY (id);
ALTER TABLE ONLY public.otp_codes
    ADD CONSTRAINT "PK_9d0487965ac1837d57fec4d6a26" PRIMARY KEY (id);
ALTER TABLE ONLY public.users
    ADD CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY (id);
ALTER TABLE ONLY public.consignments
    ADD CONSTRAINT "PK_ac4a3e322938f3ea03ee389f7c3" PRIMARY KEY (id);
ALTER TABLE ONLY public.lockouts
    ADD CONSTRAINT "PK_e06e459ce5412c806a3ba2689df" PRIMARY KEY (key);
ALTER TABLE ONLY public.message_log
    ADD CONSTRAINT "PK_f89fb3fddab953711137ce8b62c" PRIMARY KEY (id);
ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT "UQ_195b575aa2d894d665f11c1a064" UNIQUE ("trackingToken");
ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT "UQ_2310ecc5cb8be427097154b18fc" UNIQUE (slug);
ALTER TABLE ONLY public.shipments
    ADD CONSTRAINT "UQ_2a00206588a201944475d2041e1" UNIQUE ("tenantId", number);
ALTER TABLE ONLY public.message_templates
    ADD CONSTRAINT "UQ_37900f54251549e63243d256a04" UNIQUE ("tenantId", key);
ALTER TABLE ONLY public.customers
    ADD CONSTRAINT "UQ_7f5d38775dbe1b3983b871b72e7" UNIQUE ("tenantId", code);
ALTER TABLE ONLY public.users
    ADD CONSTRAINT "UQ_a000cca60bcf04454e727699490" UNIQUE (phone);
ALTER TABLE ONLY public.payments
    ADD CONSTRAINT "UQ_af929a5f2a400fdb6913b4967e1" UNIQUE ("orderId");
CREATE INDEX "IDX_1d000b64ca10f7ff9c1b5566e2" ON public.message_log USING btree ("tenantId", "createdAt");
CREATE INDEX "IDX_3ca53c9789e16452c4c202ebfb" ON public.otp_codes USING btree (phone, purpose, "createdAt");
CREATE UNIQUE INDEX "IDX_421db4b67bb48c9c90e6982dd6" ON public.shipments USING btree ("tenantId", "clientRef") WHERE ("clientRef" IS NOT NULL);
CREATE INDEX "IDX_444f4f6e937cf903ad12121f4d" ON public.payments USING btree ("tenantId", "customerId");
CREATE INDEX "IDX_44d9d599d79804975c424eebaf" ON public.releases USING btree ("tenantId", "customerId");
CREATE INDEX "IDX_4c0d50bb04cf7976e922b5781d" ON public.customers USING btree ("tenantId", phone);
CREATE INDEX "IDX_4f19da8f0437653a041cc5eae2" ON public.photos USING btree ("releaseId");
CREATE INDEX "IDX_5352818f21ed9a837b1aeab52f" ON public.shipments USING btree ("tenantId", "customerId");
CREATE INDEX "IDX_843861e42d1bd0dcb9f0ee4ed5" ON public.consignments USING btree ("tenantId", status);
CREATE INDEX "IDX_9caa3efe1d70de55f21093c69b" ON public.shipments USING btree ("consignmentId");
CREATE INDEX "IDX_c58f7e88c286e5e3478960a998" ON public.users USING btree ("tenantId");
CREATE INDEX "IDX_c747b0a69a22b026c99bac8b10" ON public.warehouses USING btree ("tenantId");
CREATE INDEX "IDX_df0f23b05584710ef5f241b6b9" ON public.message_log USING btree ("providerId");
CREATE INDEX "IDX_e0d86c92942127971af5a1d982" ON public.shipment_events USING btree ("shipmentId");
CREATE INDEX "IDX_e2290b54c259abaf4c1930794c" ON public.photos USING btree ("shipmentId");
CREATE INDEX "IDX_f871a75a10319b95ae7da8b4f2" ON public.shipments USING btree ("tenantId", status);
