import { PartialType } from '@nestjs/swagger';
import { CreateServiceDto } from './create-service.dto';

// PartialType → all fields optional + inherits all validations
export class UpdateServiceDto extends PartialType(CreateServiceDto) { }