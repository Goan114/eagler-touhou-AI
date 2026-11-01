// Reuse the same read-only world reader, planner, presets and input modifiers.
// No local-coop hooks are installed in the network build.
#define EAGLER_AI_NETPLAY
#include "AvoidanceHook.cpp"
#include "NetplayHook.hpp"

namespace {
struct CapturedInput {
    u32 frame=std::numeric_limits<u32>::max();
    Netplay::FrameInput input{};
};
std::array<CapturedInput,256> captures;
}

void Th06Ai::captureNetplay(Netplay::FrameInput& input,std::uint8_t localPlayer,
                          std::uint32_t frame,std::uint32_t generation){
    if(localPlayer>=MultiplayerGameplay::GetPlayerCount()||
       !MultiplayerGameplay::IsPlayerActive(localPlayer))return;
    if(captureGeneration!=generation||controlledSlot!=localPlayer){
        captureGeneration=generation;controlledSlot=localPlayer;
        planner.reset();followHistory.reset();resetBomb();resetInput();resetAction();
        lastFrame=std::numeric_limits<u32>::max();wasActive=false;wasRescuing=false;
        for(auto& entry:captures)entry.frame=std::numeric_limits<u32>::max();
    }
    auto& saved=captures[frame%captures.size()];
    if(saved.frame==frame){input=saved.input;return;}
    captureFrame=frame;
    int teammate=-1;
    for(int seat=0;seat<MultiplayerGameplay::GetPlayerCount();++seat){
        if(seat!=controlledSlot&&MultiplayerGameplay::IsPlayerActive(seat)){
            teammate=seat;break;
        }
    }
    // Keep a non-self slot even after the last teammate leaves; formation
    // and rescue already ignore inactive slots, while dodging stays enabled.
    if(teammate<0)teammate=controlledSlot==0?1:0;
    if(teammateSlot!=teammate){teammateSlot=teammate;followHistory.reset();}
    humanBombRequested=false;
    sampleTeammate();
    const auto buttons=filter(input.buttons);
    if(active&&!(result.flags&(IncompleteWorld|InvalidWorld))){
        input.buttons=buttons;
        // Keyboard AI owns movement; discard this frame's physical analog
        // displacement so a held stick/touch cannot move the ship a second time.
        input.analogMode=Netplay::AnalogMode::None;input.x=input.y=0;
        input.unlimited=false;input.touchUsed=false;input.touchBomb=false;
    }
    saved.frame=frame;saved.input=input;
}
