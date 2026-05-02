import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { CreateUserDto } from '../create-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  createUser(@Body() body: CreateUserDto) {
    return this.usersService.createUser(body);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  getUsers() {
    return this.usersService.getUsers();
  }

  @Delete(':id')
  deleteUser(@Param('id') id: string) {
    return this.usersService.deleteUser(Number(id));
  }

  @Put(':id')
  updateUser(@Param('id') id: string, @Body() body: { name?: string; email?: string }) {
    return this.usersService.updateUser(Number(id), body);
  }
}export class UsersModule {}
