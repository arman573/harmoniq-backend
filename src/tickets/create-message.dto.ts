import { IsNotEmpty, IsString } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  sender!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;
}
