import { MigrationInterface, QueryRunner } from "typeorm";

export class Initial1793598174152 implements MigrationInterface {
    name = 'Initial1793598174152'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "staff" ("id" SERIAL NOT NULL, "name" character varying(120) NOT NULL, "phone" character varying(20) NOT NULL, "email" character varying(160), "jobRole" character varying(80) NOT NULL DEFAULT '', "isOwner" boolean NOT NULL DEFAULT false, "active" boolean NOT NULL DEFAULT true, "passwordHash" character varying(100) NOT NULL, "mustChangePassword" boolean NOT NULL DEFAULT true, "twoFactorMethod" character varying(10), "totpSecret" text, "access" jsonb NOT NULL, "tokenVersion" integer NOT NULL DEFAULT '0', "lastSeenAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_4d4956f0d921cf205e2c34e130b" UNIQUE ("phone"), CONSTRAINT "PK_e4ee98bb552756c180aec1e854a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "staffId" integer NOT NULL, "tokenHash" character varying(64) NOT NULL, "prevHash" character varying(64), "rotatedAt" TIMESTAMP WITH TIME ZONE, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "revokedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_3238ef96f18b355b671619111bc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_05fb82e310500970fd2a0f16e3" ON "sessions" ("staffId") `);
        await queryRunner.query(`CREATE TABLE "lockouts" ("key" character varying(80) NOT NULL, "failures" integer NOT NULL DEFAULT '0', "lastFailureAt" TIMESTAMP WITH TIME ZONE, "lockedUntil" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_e06e459ce5412c806a3ba2689df" PRIMARY KEY ("key"))`);
        await queryRunner.query(`CREATE TABLE "otp_codes" ("id" SERIAL NOT NULL, "phone" character varying(20) NOT NULL, "purpose" character varying(40) NOT NULL, "codeHash" character varying(64) NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "attempts" integer NOT NULL DEFAULT '0', "consumedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_9d0487965ac1837d57fec4d6a26" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3ca53c9789e16452c4c202ebfb" ON "otp_codes" ("phone", "purpose", "createdAt") `);
        await queryRunner.query(`CREATE TABLE "activity_log" ("id" SERIAL NOT NULL, "staffId" integer, "staffName" character varying(120) NOT NULL, "action" character varying(40) NOT NULL, "system" character varying(20), "text" character varying(300) NOT NULL, "ip" character varying(45), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_067d761e2956b77b14e534fd6f1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_4df1cd3ed889a9d5cdd69e5347" ON "activity_log" ("createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_24f4d7dbf1bdf7d1e6917251f7" ON "activity_log" ("staffId", "createdAt") `);
        await queryRunner.query(`CREATE TABLE "uptime_check" ("id" BIGSERIAL NOT NULL, "target" character varying(60) NOT NULL, "kind" character varying(10) NOT NULL, "ok" boolean NOT NULL, "statusCode" integer, "responseMs" integer, "checkedAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_d361f5c6e0e0f193b921c30d2d2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_d30084d2ca326212d4f2ee90d2" ON "uptime_check" ("checkedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_57642cb19ac4191b374697a2da" ON "uptime_check" ("target", "checkedAt") `);
        await queryRunner.query(`CREATE TABLE "uptime_daily" ("date" date NOT NULL, "target" character varying(60) NOT NULL, "checks" integer NOT NULL, "okChecks" integer NOT NULL, "avgMs" integer, CONSTRAINT "PK_8d061d4b26ac0768fd14ca24a5e" PRIMARY KEY ("date", "target"))`);
        await queryRunner.query(`CREATE TABLE "visitor_daily" ("date" date NOT NULL, "site" character varying(60) NOT NULL, "visitors" integer NOT NULL DEFAULT '0', "pageViews" integer NOT NULL DEFAULT '0', "sources" jsonb NOT NULL DEFAULT '{}', "sketch" bytea NOT NULL, CONSTRAINT "PK_3d1db6c1a692de01987d55870ae" PRIMARY KEY ("date", "site"))`);
        await queryRunner.query(`CREATE TABLE "log_offset" ("path" character varying(300) NOT NULL, "inode" bigint, "offset" bigint NOT NULL DEFAULT '0', "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_93f6c78d9888042b1106118b17a" PRIMARY KEY ("path"))`);
        await queryRunner.query(`CREATE TABLE "manual_note" ("id" SERIAL NOT NULL, "system" character varying(20) NOT NULL, "title" character varying(140) NOT NULL, "detail" character varying(300) NOT NULL DEFAULT '', "severity" character varying(10) NOT NULL DEFAULT 'warn', "createdById" integer NOT NULL, "createdByName" character varying(120) NOT NULL, "resolvedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_53b6c9cbd2dce3e476e9ced8d07" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "system_note" ("card" character varying(20) NOT NULL, "note" character varying(40) NOT NULL, "updatedByName" character varying(120) NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_73eea2ef2fa243c828e77e058f9" PRIMARY KEY ("card"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "system_note"`);
        await queryRunner.query(`DROP TABLE "manual_note"`);
        await queryRunner.query(`DROP TABLE "log_offset"`);
        await queryRunner.query(`DROP TABLE "visitor_daily"`);
        await queryRunner.query(`DROP TABLE "uptime_daily"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_57642cb19ac4191b374697a2da"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d30084d2ca326212d4f2ee90d2"`);
        await queryRunner.query(`DROP TABLE "uptime_check"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_24f4d7dbf1bdf7d1e6917251f7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4df1cd3ed889a9d5cdd69e5347"`);
        await queryRunner.query(`DROP TABLE "activity_log"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3ca53c9789e16452c4c202ebfb"`);
        await queryRunner.query(`DROP TABLE "otp_codes"`);
        await queryRunner.query(`DROP TABLE "lockouts"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_05fb82e310500970fd2a0f16e3"`);
        await queryRunner.query(`DROP TABLE "sessions"`);
        await queryRunner.query(`DROP TABLE "staff"`);
    }

}
