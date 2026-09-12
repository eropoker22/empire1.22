import { describe, expect, it } from 'vitest';
import type { Bounty } from '@empire/shared-types';
import { createCombatStateFixture } from '../../fixtures/game-state-fixtures';
import { createBountyReadModel } from '../../../packages/game-core/src/projections/bounty-read-model-projection';
import { createDistrictSummaryViews } from '../../../packages/game-core/src/projections/district-summary-projection';
import { settleUnclaimedBounty } from '../../../packages/game-core/src/handlers/bountySettlement';

const bounty: Bounty = {id:'bounty:active',createdByPlayerId:'player:1',targetPlayerId:'player:2',targetDistrictId:'district:2',
  objectiveType:'attack-district',rewardCleanCash:5000,status:'active',createdAtTick:0,expiresAtTick:360,
  claimedByPlayerId:null,claimedAtTick:null,cancelledAtTick:null,isAnonymous:true,version:1};

describe('player feedback projection follow-up',()=>{
  it('retains all live contracts in the projection after history grows',()=>{
    const state=createCombatStateFixture();state.root.tick=100;state.bountiesById={};
    for(let i=0;i<60;i++)state.bountiesById[`live:${i}`]={...bounty,id:`live:${i}`};
    for(let i=0;i<70;i++)state.bountiesById[`closed:${i}`]={...bounty,id:`closed:${i}`,status:'cancelled',createdAtTick:i+1,cancelledAtTick:i+1};
    const before=JSON.stringify(state);
    const projection=createBountyReadModel(state,'player:2',{tickRateMs:10000});
    expect(projection.activeBounties.filter(b=>b.status==='active')).toHaveLength(60);
    expect(projection.activeBounties.filter(b=>b.status!=='active')).toHaveLength(50);
    expect(projection.activeBounties.every(b=>b.createdByLabel==='Anonym')).toBe(true);
    expect(JSON.stringify(state)).toBe(before);
  });
  it('projects cancellation with zero remaining time after settlement',()=>{
    const state=createCombatStateFixture();state.root.tick=100;state.bountiesById={[bounty.id]:bounty};
    const settled=settleUnclaimedBounty(state,bounty.id,'creator_cancelled').nextState;
    const projection=createBountyReadModel(settled,'player:2',{tickRateMs:10000});
    expect(projection.activeBounties[0]).toMatchObject({bountyId:bounty.id,status:'cancelled',remainingMs:0});
  });
  it('publishes the current public owner name and clears it for destroyed or unowned districts',()=>{
    const state=createCombatStateFixture();state.playersById['player:2'].metadata={displayName:'  Skutečný nick  ',privateNote:'secret'};
    const selected=()=>createDistrictSummaryViews(state,'player:1').find(d=>d.districtId==='district:2')!;
    expect(selected()).toMatchObject({ownerPlayerId:'player:2',ownerName:'Skutečný nick'});
    expect(JSON.stringify(selected())).not.toContain('secret');
    state.districtsById['district:2'].status='destroyed';expect(selected()).toMatchObject({ownerPlayerId:null,ownerName:null});
    state.districtsById['district:2'].status='neutral';state.districtsById['district:2'].ownerPlayerId=null;
    expect(selected().ownerName).toBeNull();
  });
});
