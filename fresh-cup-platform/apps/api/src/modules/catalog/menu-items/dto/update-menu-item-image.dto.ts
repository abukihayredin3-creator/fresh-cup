import { PartialType } from "@nestjs/mapped-types";
import { CreateMenuItemImageDto } from "./create-menu-item-image.dto";

export class UpdateMenuItemImageDto extends PartialType(CreateMenuItemImageDto) {}
