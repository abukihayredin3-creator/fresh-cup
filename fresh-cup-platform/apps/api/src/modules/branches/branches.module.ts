import { Module } from "@nestjs/common";
import { TenancyModule } from "../../enterprise/tenancy/tenancy.module";
import { BranchesController } from "./branches.controller";
import { BranchesService } from "./branches.service";

@Module({
  imports: [TenancyModule],
  controllers: [BranchesController],
  providers: [BranchesService],
  exports: [BranchesService],
})
export class BranchesModule {}
