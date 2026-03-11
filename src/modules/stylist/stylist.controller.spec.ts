import { Test, TestingModule } from '@nestjs/testing';
import { StylistController } from './stylist.controller';

describe('StylistController', () => {
  let controller: StylistController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StylistController],
    }).compile();

    controller = module.get<StylistController>(StylistController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
