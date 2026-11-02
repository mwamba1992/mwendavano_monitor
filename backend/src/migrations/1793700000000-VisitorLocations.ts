import { MigrationInterface, QueryRunner } from "typeorm";

export class VisitorLocations1793700000000 implements MigrationInterface {
    name = 'VisitorLocations1793700000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "visitor_daily" ADD "locations" jsonb NOT NULL DEFAULT '{}'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "visitor_daily" DROP COLUMN "locations"`);
    }
}
