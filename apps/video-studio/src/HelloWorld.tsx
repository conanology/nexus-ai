import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';

interface HelloWorldProps {
  titleText: string;
  titleColor: string;
}

export const HelloWorld: React.FC<HelloWorldProps> = ({
  titleText,
  titleColor,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        fontSize: 80,
        backgroundColor: 'white',
      }}
    >
      <div style={{ color: titleColor, opacity }}>
        {titleText}
      </div>
    </AbsoluteFill>
  );
};
