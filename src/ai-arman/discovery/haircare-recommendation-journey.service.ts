import { BadRequestException, Injectable } from '@nestjs/common';
import type { AiArmanInterpretation } from '../chat/chat-messages.types';
import type { ProductIntelligenceRequestProduct } from '../integrations/product-intelligence.types';
import { ProductDiscoveryService } from './product-discovery.service';
import { ProductIntelligenceEnrichmentService } from './product-intelligence