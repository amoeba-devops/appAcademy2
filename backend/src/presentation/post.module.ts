import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostEntity } from '../infrastructure/database/entities/post.entity';
import { PostRepository } from '../infrastructure/database/repositories/post.repository';
import { POST_REPOSITORY } from '../domain/repositories/post-repository.interface';
import { GetPostsUseCase } from '../application/use-cases/post';
import { PortalNewsController } from './controllers/portal-news.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PostEntity])],
  controllers: [PortalNewsController],
  providers: [
    { provide: POST_REPOSITORY, useClass: PostRepository },
    GetPostsUseCase,
  ],
  exports: [POST_REPOSITORY],
})
export class PostModule {}
