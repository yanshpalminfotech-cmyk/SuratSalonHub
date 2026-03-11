import { Test, TestingModule } from '@nestjs/testing';
import { StylistService } from './stylist.service';

describe('StylistService', () => {
  let service: StylistService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StylistService],
    }).compile();

    service = module.get<StylistService>(StylistService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
