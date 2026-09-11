import { describe, expect, it } from 'vitest';
import { resolveModeConfig } from '@empire/game-config';
import { createReplacementValueResolver } from '../../../packages/game-core/src/rules/economy/replacementValue';
import { initializeServerMarket, calculateMarketPrice, getMarketViewModel, sellResource } from '../../../packages/game-core/src/rules/market/serverMarketSystem';
import type { MarketResourceId } from '../../../packages/game-core/src/rules/market/market-types';
import { marketReplacementCost, marketResourceIds, normalMarketResourceIds, blackMarketResourceIds } from '../../../packages/game-core/src/rules/market/market-config';
const config = resolveModeConfig('free');
const costs = createReplacementValueResolver(config);
function cost(id: MarketResourceId): number {
 const value=costs.resolve(id); if(value===null) throw new Error(`Missing canonical cost: ${id}`); return value;
}
function fixture() {
 return initializeServerMarket({mode:'free', buildingsById:{} as Record<string,{id:string;ownerPlayerId:string;buildingTypeId:string;status:string}>, players: Array.from({length:20},(_,i)=>({id:`player:${i}`,cleanCash:6000,dirtyCash:3000,resources:{} as Record<string,number>}))},0);
}
describe('market prices against the complete production chain',()=>{
 it('keeps all 21 reference costs aligned with authoritative recipes',()=>{
   for(const id of marketResourceIds) expect(marketReplacementCost[id],id).toBe(cost(id));
 });
 it('offers an affordable convenience premium while preserving production value',()=>{
   const s=fixture();
   for(const id of normalMarketResourceIds) {
     const price=calculateMarketPrice(s,id,'normal').finalPrice;
     expect(price,id).toBeGreaterThan(cost(id));expect(price,id).toBeLessThan(cost(id)*1.65);
   }
   for(const id of blackMarketResourceIds) {
     const price=calculateMarketPrice(s,id,'black').finalPrice;
     expect(price,id).toBeGreaterThan(cost(id)*1.5);expect(price,id).toBeLessThan(cost(id)*2.6);
   }
 });
 it('does not invent scarcity for a resource absent from the ordinary market',()=>{
   const s=fixture();const before=calculateMarketPrice(s,'tech-core','black');
   s.market.stock['tech-core']=80;
   const after=calculateMarketPrice(s,'tech-core','black');
   expect(after.finalPrice).toBe(before.finalPrice);expect(after.factors.scarcityFactor).toBe(1);
   const metal=calculateMarketPrice(s,'metal-parts','normal').finalPrice;s.market.stock['metal-parts']=0;
   expect(calculateMarketPrice(s,'metal-parts','normal').finalPrice).toBeGreaterThan(metal);
 });
 it('keeps the actual discounted purchase above production and the immediate resale price',()=>{
   const s=fixture();s.buildingsById=Object.fromEntries(Array.from({length:7},(_,i)=>[String(i),{id:String(i),ownerPlayerId:'player:0',buildingTypeId:'shopping_mall',status:'active'}]));
   const view=getMarketViewModel(s,s.players[0],0,{config});
   for(const id of normalMarketResourceIds){
     const item=view.resources.find((r:any)=>r.id===id);
     expect(item, id).toBeDefined();
     expect(item!.normalMarket.price,id).toBeGreaterThan(cost(id));
     expect(item!.normalMarket.sellPrice,id).toBeLessThan(item!.normalMarket.price);
     if (item!.normalMarket.available) {
       s.players[0].resources = {[id]:1};
       const sold=sellResource(s,s.players[0],id,1,0,{config});
       expect(sold.success, sold.reason).toBe(true);
       expect(sold.unitPrice,id).toBe(item!.normalMarket.sellPrice);
     }
   }
 });
});
