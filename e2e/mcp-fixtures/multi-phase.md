@markdownai

# Multi-Phase Project

@phase setup
@include ./phases/phase-1.md
@on complete -> @phase implementation
@end

@phase implementation
@include ./phases/phase-2.md
@on complete -> @phase review
@end

@phase review
@include ./phases/phase-3.md
@end
