#pragma once
#include <cstdint>
#include <eagler/netplay/NetplayProtocol.hpp>

namespace Th06Ai {
// Called only when the network owner captures a NEW local input slot.
// Rollback and confirmed replay consume the stored FrameInput directly.
void captureNetplay(Netplay::FrameInput& input,std::uint8_t localPlayer,
                    std::uint32_t frame,std::uint32_t generation);
}
