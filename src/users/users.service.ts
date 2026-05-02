import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  createUser(data: { name: string; email: string; password?: string }) {
    return this.userRepository.save(data);
  }

  getUsers() {
    return this.userRepository.find();
  }

  findById(id: number) {
    return this.userRepository.findOneBy({ id });
  }

  findByEmail(email: string) {
    return this.userRepository.findOneBy({ email });
  }

  findByEmailWithPassword(email: string) {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email })
      .getOne();
  }

  async deleteUser(id: number) {
    await this.userRepository.delete(id);
    return { deleted: true, id };
  }

  async updateUser(id: number, data: { name?: string; email?: string }) {
    await this.userRepository.update(id, data);
    return this.userRepository.findOneBy({ id });
  }
}
