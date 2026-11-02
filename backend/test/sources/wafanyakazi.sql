CREATE TABLE public.advance_requests (
    id integer NOT NULL,
    "businessId" integer NOT NULL,
    "employeeId" integer NOT NULL,
    amount integer NOT NULL,
    reason character varying,
    status character varying DEFAULT 'PENDING'::character varying NOT NULL,
    "requestedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "decidedAt" timestamp with time zone,
    "decidedById" integer,
    "payrollRunId" integer,
    "payslipId" integer
);
CREATE SEQUENCE public.advance_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.advance_requests_id_seq OWNED BY public.advance_requests.id;
CREATE TABLE public.attendance (
    id integer NOT NULL,
    "businessId" integer NOT NULL,
    "employeeId" integer NOT NULL,
    "branchId" integer,
    date date NOT NULL,
    "clockInAt" timestamp with time zone NOT NULL,
    "clockOutAt" timestamp with time zone,
    "inLat" double precision,
    "inLng" double precision,
    "inAccuracy" double precision,
    "inDistanceM" integer,
    "inStatus" character varying NOT NULL,
    "outLat" double precision,
    "outLng" double precision,
    "outStatus" character varying,
    method character varying DEFAULT 'SELF'::character varying NOT NULL,
    "deviceId" character varying,
    "selfiePath" character varying,
    "lateMinutes" integer DEFAULT 0 NOT NULL,
    "workedMinutes" integer,
    "offlineSynced" boolean DEFAULT false NOT NULL
);
CREATE SEQUENCE public.attendance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.attendance_id_seq OWNED BY public.attendance.id;
CREATE TABLE public.branches (
    id integer NOT NULL,
    "businessId" integer NOT NULL,
    name character varying NOT NULL,
    lat double precision,
    lng double precision,
    "radiusM" integer DEFAULT 150 NOT NULL,
    active boolean DEFAULT true NOT NULL
);
CREATE SEQUENCE public.branches_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.branches_id_seq OWNED BY public.branches.id;
CREATE TABLE public.businesses (
    id integer NOT NULL,
    name character varying NOT NULL,
    phone character varying,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE public.businesses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.businesses_id_seq OWNED BY public.businesses.id;
CREATE TABLE public.device_tokens (
    id integer NOT NULL,
    "businessId" integer NOT NULL,
    "employeeId" integer NOT NULL,
    token character varying(4096) NOT NULL,
    platform character varying NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE public.device_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.device_tokens_id_seq OWNED BY public.device_tokens.id;
CREATE TABLE public.employees (
    id integer NOT NULL,
    "businessId" integer NOT NULL,
    "branchId" integer,
    name character varying NOT NULL,
    phone character varying NOT NULL,
    role character varying DEFAULT 'WORKER'::character varying NOT NULL,
    "jobTitle" character varying,
    "grossSalary" integer DEFAULT 0 NOT NULL,
    "shiftStart" character varying DEFAULT '08:00'::character varying NOT NULL,
    "shiftEnd" character varying DEFAULT '17:00'::character varying NOT NULL,
    "workDays" integer[] DEFAULT '{1,2,3,4,5,6}'::integer[] NOT NULL,
    "pinHash" character varying NOT NULL,
    "nssfNumber" character varying,
    "payrollIncluded" boolean DEFAULT true NOT NULL,
    active boolean DEFAULT true NOT NULL,
    "joinedAt" date NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "tokenVersion" integer DEFAULT 0 NOT NULL
);
CREATE SEQUENCE public.employees_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.employees_id_seq OWNED BY public.employees.id;
CREATE TABLE public.kiosk_devices (
    id integer NOT NULL,
    "businessId" integer NOT NULL,
    "branchId" integer NOT NULL,
    name character varying NOT NULL,
    "tokenHash" character varying NOT NULL,
    active boolean DEFAULT true NOT NULL,
    "lastSeenAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE public.kiosk_devices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.kiosk_devices_id_seq OWNED BY public.kiosk_devices.id;
CREATE TABLE public.leave_requests (
    id integer NOT NULL,
    "businessId" integer NOT NULL,
    "employeeId" integer NOT NULL,
    type character varying NOT NULL,
    "startDate" date NOT NULL,
    "endDate" date NOT NULL,
    days integer NOT NULL,
    reason character varying,
    status character varying DEFAULT 'PENDING'::character varying NOT NULL,
    "requestedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "decidedAt" timestamp with time zone,
    "decidedById" integer
);
CREATE SEQUENCE public.leave_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.leave_requests_id_seq OWNED BY public.leave_requests.id;
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
CREATE TABLE public.notifications (
    id integer NOT NULL,
    "businessId" integer NOT NULL,
    "employeeId" integer NOT NULL,
    type character varying NOT NULL,
    title character varying NOT NULL,
    body text NOT NULL,
    "titleEn" character varying NOT NULL,
    "bodyEn" text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    "readAt" timestamp with time zone,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;
CREATE TABLE public.otp_codes (
    id integer NOT NULL,
    phone character varying(20) NOT NULL,
    purpose character varying(20) NOT NULL,
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
CREATE TABLE public.payroll_runs (
    id integer NOT NULL,
    "businessId" integer NOT NULL,
    year integer NOT NULL,
    month integer NOT NULL,
    status character varying DEFAULT 'DRAFT'::character varying NOT NULL,
    gross integer DEFAULT 0 NOT NULL,
    "nssfEmployee" integer DEFAULT 0 NOT NULL,
    paye integer DEFAULT 0 NOT NULL,
    advances integer DEFAULT 0 NOT NULL,
    net integer DEFAULT 0 NOT NULL,
    "nssfEmployer" integer DEFAULT 0 NOT NULL,
    sdl integer DEFAULT 0 NOT NULL,
    wcf integer DEFAULT 0 NOT NULL,
    "employeeCount" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "finalizedAt" timestamp with time zone
);
CREATE SEQUENCE public.payroll_runs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.payroll_runs_id_seq OWNED BY public.payroll_runs.id;
CREATE TABLE public.payslips (
    id integer NOT NULL,
    "businessId" integer NOT NULL,
    "payrollRunId" integer NOT NULL,
    "employeeId" integer NOT NULL,
    "employeeName" character varying NOT NULL,
    "jobTitle" character varying,
    gross integer NOT NULL,
    "nssfEmployee" integer NOT NULL,
    taxable integer NOT NULL,
    paye integer NOT NULL,
    advances integer NOT NULL,
    net integer NOT NULL,
    "nssfEmployer" integer NOT NULL,
    sdl integer NOT NULL,
    wcf integer NOT NULL,
    "paidAt" timestamp with time zone,
    "paidMethod" character varying,
    "paidRef" character varying
);
CREATE SEQUENCE public.payslips_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.payslips_id_seq OWNED BY public.payslips.id;
CREATE TABLE public.pin_lockouts (
    key character varying(120) NOT NULL,
    failures integer DEFAULT 0 NOT NULL,
    "lastFailureAt" timestamp with time zone,
    "lockedUntil" timestamp with time zone,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE public.sms_log (
    id integer NOT NULL,
    "businessId" integer,
    phone character varying(20) NOT NULL,
    purpose character varying(40) NOT NULL,
    status character varying(10) NOT NULL,
    "providerResponse" text,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE SEQUENCE public.sms_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.sms_log_id_seq OWNED BY public.sms_log.id;
ALTER TABLE ONLY public.advance_requests ALTER COLUMN id SET DEFAULT nextval('public.advance_requests_id_seq'::regclass);
ALTER TABLE ONLY public.attendance ALTER COLUMN id SET DEFAULT nextval('public.attendance_id_seq'::regclass);
ALTER TABLE ONLY public.branches ALTER COLUMN id SET DEFAULT nextval('public.branches_id_seq'::regclass);
ALTER TABLE ONLY public.businesses ALTER COLUMN id SET DEFAULT nextval('public.businesses_id_seq'::regclass);
ALTER TABLE ONLY public.device_tokens ALTER COLUMN id SET DEFAULT nextval('public.device_tokens_id_seq'::regclass);
ALTER TABLE ONLY public.employees ALTER COLUMN id SET DEFAULT nextval('public.employees_id_seq'::regclass);
ALTER TABLE ONLY public.kiosk_devices ALTER COLUMN id SET DEFAULT nextval('public.kiosk_devices_id_seq'::regclass);
ALTER TABLE ONLY public.leave_requests ALTER COLUMN id SET DEFAULT nextval('public.leave_requests_id_seq'::regclass);
ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);
ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);
ALTER TABLE ONLY public.otp_codes ALTER COLUMN id SET DEFAULT nextval('public.otp_codes_id_seq'::regclass);
ALTER TABLE ONLY public.payroll_runs ALTER COLUMN id SET DEFAULT nextval('public.payroll_runs_id_seq'::regclass);
ALTER TABLE ONLY public.payslips ALTER COLUMN id SET DEFAULT nextval('public.payslips_id_seq'::regclass);
ALTER TABLE ONLY public.sms_log ALTER COLUMN id SET DEFAULT nextval('public.sms_log_id_seq'::regclass);
ALTER TABLE ONLY public.pin_lockouts
    ADD CONSTRAINT "PK_09db39cd4a26f8c2859de95869d" PRIMARY KEY (key);
ALTER TABLE ONLY public.payslips
    ADD CONSTRAINT "PK_2b1cd07059daf60cc440c9976e1" PRIMARY KEY (id);
ALTER TABLE ONLY public.payroll_runs
    ADD CONSTRAINT "PK_6049f42c972640c0eb99ba8035e" PRIMARY KEY (id);
ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY (id);
ALTER TABLE ONLY public.advance_requests
    ADD CONSTRAINT "PK_7e59fae6ecc721486bfd1d19222" PRIMARY KEY (id);
ALTER TABLE ONLY public.branches
    ADD CONSTRAINT "PK_7f37d3b42defea97f1df0d19535" PRIMARY KEY (id);
ALTER TABLE ONLY public.device_tokens
    ADD CONSTRAINT "PK_84700be257607cfb1f9dc2e52c3" PRIMARY KEY (id);
ALTER TABLE ONLY public.sms_log
    ADD CONSTRAINT "PK_8554ae1be4b0fb14d36cb190b61" PRIMARY KEY (id);
ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT "PK_8c82d7f526340ab734260ea46be" PRIMARY KEY (id);
ALTER TABLE ONLY public.otp_codes
    ADD CONSTRAINT "PK_9d0487965ac1837d57fec4d6a26" PRIMARY KEY (id);
ALTER TABLE ONLY public.employees
    ADD CONSTRAINT "PK_b9535a98350d5b26e7eb0c26af4" PRIMARY KEY (id);
ALTER TABLE ONLY public.businesses
    ADD CONSTRAINT "PK_bc1bf63498dd2368ce3dc8686e8" PRIMARY KEY (id);
ALTER TABLE ONLY public.kiosk_devices
    ADD CONSTRAINT "PK_c4d72f67c19f337b3614f9b811f" PRIMARY KEY (id);
ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT "PK_d3abcf9a16cef1450129e06fa9f" PRIMARY KEY (id);
ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT "PK_ee0ffe42c1f1a01e72b725c0cb2" PRIMARY KEY (id);
ALTER TABLE ONLY public.payroll_runs
    ADD CONSTRAINT "UQ_02e4a41e75f25445cff4aee7386" UNIQUE ("businessId", year, month);
ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT "UQ_9bc37e611804f2566dbb4c85d22" UNIQUE ("employeeId", date);
ALTER TABLE ONLY public.employees
    ADD CONSTRAINT "UQ_cbc362d1c574464a63d3acc3ead" UNIQUE (phone);
CREATE INDEX "IDX_34701552a5f3c7d4f1046121d3" ON public.leave_requests USING btree ("businessId", status);
CREATE INDEX "IDX_34883704c34ad1f0b9135d59d5" ON public.advance_requests USING btree ("businessId", status);
CREATE INDEX "IDX_3a313a96e02178517e8342e59c" ON public.device_tokens USING btree ("employeeId");
CREATE INDEX "IDX_3fa0aa64d0a6d751ea49e6cd80" ON public.payslips USING btree ("employeeId");
CREATE UNIQUE INDEX "IDX_4532b45a5d1b91967f6cbb9088" ON public.kiosk_devices USING btree ("tokenHash");
CREATE INDEX "IDX_4eda1468756ca831495e308e40" ON public.leave_requests USING btree ("employeeId");
CREATE INDEX "IDX_7fa917995acd9e574f51f1239c" ON public.notifications USING btree ("employeeId", "createdAt");
CREATE INDEX "IDX_900143f20e6cd2fc0153db2242" ON public.payslips USING btree ("payrollRunId");
CREATE INDEX "IDX_971e6ab8a3988d566fc8de76d3" ON public.advance_requests USING btree ("employeeId");
CREATE UNIQUE INDEX "IDX_977e24c520c49436d08e5eeea8" ON public.device_tokens USING btree (token);
CREATE INDEX "IDX_b874e5030fa1d52bc338dae892" ON public.branches USING btree ("businessId");
CREATE INDEX "IDX_c0a85906f3a73c2b47f7699bda" ON public.employees USING btree ("businessId");
CREATE INDEX "IDX_c29318b88c272d12db7373461e" ON public.otp_codes USING btree (phone, "createdAt");
CREATE INDEX "IDX_e64c30263008e4b433e0ba16a5" ON public.attendance USING btree ("businessId", date);
CREATE INDEX "IDX_f4e08c07e5be22267f1129f31a" ON public.sms_log USING btree ("businessId");
