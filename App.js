import React, {useState, useRef} from 'react';
import {
  SafeAreaView,
  Dimensions,
  Pressable,
  Text,
  StyleSheet,
  View,
  ScrollView,
  Image,
} from 'react-native';

import ImagePicker from 'react-native-image-crop-picker';
import Video from 'react-native-video';
import FFmpegWrapper from './lib/FFmpeg';

const SCREEN_WIDTH = Dimensions.get('screen').width;
const SCREEN_HEIGHT = Dimensions.get('screen').height;
export const FRAME_PER_SEC = 1;
export const FRAME_WIDTH = 80;
const TILE_HEIGHT = 80;
const TILE_WIDTH = FRAME_WIDTH / 2; // to get a 2x resolution

const DURATION_WINDOW_DURATION = 4;
const DURATION_WINDOW_BORDER_WIDTH = 4;
const DURATION_WINDOW_WIDTH =
  DURATION_WINDOW_DURATION * FRAME_PER_SEC * TILE_WIDTH;
const POPLINE_POSITION = '50%';

const getFileNameFromPath = path => {
  const fragments = path.split('/');
  let fileName = fragments[fragments.length - 1];
  fileName = fileName.split('.')[0];
  return fileName;
};

const FRAME_STATUS = Object.freeze({
  LOADING: {name: Symbol('LOADING')},
  READY: {name: Symbol('READY')},
});

const getLeftLinePlayTime = offset => {
  return offset / (FRAME_PER_SEC * TILE_WIDTH);
};
const getRightLinePlayTime = offset => {
  return (offset + DURATION_WINDOW_WIDTH) / (FRAME_PER_SEC * TILE_WIDTH);
};
const getPopLinePlayTime = offset => {
  return (
    (offset + (DURATION_WINDOW_WIDTH * parseFloat(POPLINE_POSITION)) / 100) /
    (FRAME_PER_SEC * TILE_WIDTH)
  );
};

const App = () => {
  const [selectedVideo, setSelectedVideo] = useState(); // {uri: <string>, localFileName: <string>, creationDate: <Date>}
  const [frames, setFrames] = useState(); // <[{status: <FRAME_STATUS>, uri: <string>}]>
  const [framesLineOffset, setFramesLineOffset] = useState(0); // number
  const [paused, setPaused] = useState(false);

  const videoPlayerRef = useRef();

  const handlePressSelectVideoButton = () => {
    ImagePicker.openPicker({
      mediaType: 'video',
    }).then(videoAsset => {
      console.log(`Selected video ${JSON.stringify(videoAsset, null, 2)}`);
      setSelectedVideo({
        uri: videoAsset.sourceURL || videoAsset.path,
        localFileName: getFileNameFromPath(videoAsset.path),
        creationDate: videoAsset.creationDate,
      });
    });
  };

  const handleOnTouchStart = () => {
    setPaused(true);
  };
  const handleOnTouchEnd = () => {
    setPaused(false);
  };

  const handleOnScroll = ({nativeEvent}) => {
    const playbackTime = getPopLinePlayTime(nativeEvent.contentOffset.x);
    videoPlayerRef.current?.seek(playbackTime);
    setFramesLineOffset(nativeEvent.contentOffset.x);
  };

  const handleVideoLoad = videoAssetLoaded => {
    const numberOfFrames = Math.ceil(videoAssetLoaded.duration);
    setFrames(
      Array(numberOfFrames).fill({
        status: FRAME_STATUS.LOADING.name.description,
      }),
    );

    FFmpegWrapper.getFrames(
      selectedVideo.localFileName,
      selectedVideo.uri,
      numberOfFrames,
      filePath => {
        const _framesURI = [];
        for (let i = 0; i < numberOfFrames; i++) {
          _framesURI.push(
            `${filePath.replace('%4d', String(i + 1).padStart(4, 0))}`,
          );
        }
        const _frames = _framesURI.map(_frameURI => ({
          uri: _frameURI,
          status: FRAME_STATUS.READY.name.description,
        }));
        setFrames(_frames);
      },
    );
  };

  const handleOnProgress = ({currentTime}) => {
    if (currentTime >= getRightLinePlayTime(framesLineOffset)) {
      videoPlayerRef.current.seek(getLeftLinePlayTime(framesLineOffset));
    }
  };

  const renderFrame = (frame, index) => {
    if (frame.status === FRAME_STATUS.LOADING.name.description) {
      return <View style={styles.loadingFrame} key={index} />;
    } else {
      return (
        <Image
          key={index}
          source={{uri: 'file://' + frame.uri}}
          style={{
            width: TILE_WIDTH,
            height: TILE_HEIGHT,
            zIndex: 10,
          }}
          onLoad={() => {
            console.log('Image loaded');
          }}
        />
      );
    }
  };

  return (
    <SafeAreaView style={styles.mainContainer}>
      {selectedVideo ? (
        <>
          <View style={styles.videoContainer}>
            <Video
              ref={videoPlayerRef}
              style={styles.video}
              resizeMode={'cover'}
              source={{uri: selectedVideo.uri}}
              repeat={true}
              paused={paused}
              onLoad={handleVideoLoad}
              onProgress={handleOnProgress}
            />
          </View>
          {frames && (
            <View style={styles.durationWindowAndFramesLineContainer}>
              <View style={styles.durationWindow}>
                <View style={styles.durationLabelContainer}>
                  <Text style={styles.durationLabel}>
                    {DURATION_WINDOW_DURATION} sec.
                  </Text>
                </View>
              </View>
              <View style={styles.popLineContainer}>
                <View style={styles.popLine} />
              </View>
              <View style={styles.durationWindowLeftBorder} />
              <View style={styles.durationWindowRightBorder} />
              <ScrollView
                showsHorizontalScrollIndicator={false}
                horizontal={true}
                style={styles.framesLine}
                alwaysBounceHorizontal={true}
                scrollEventThrottle={1}
                onScroll={handleOnScroll}
                onTouchStart={handleOnTouchStart}
                onTouchEnd={handleOnTouchEnd}
                onMomentumScrollEnd={handleOnTouchEnd}>
                <View style={styles.prependFrame} />
                {frames.map((frame, index) => renderFrame(frame, index))}
                <View style={styles.appendFrame} />
              </ScrollView>
            </View>
          )}
        </>
      ) : (
        <Pressable
          style={styles.buttonContainer}
          onPress={handlePressSelectVideoButton}>
          <Text style={styles.buttonText}>Select a video</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContainer: {
    backgroundColor: '#000',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 16,
  },
  buttonText: {
    color: '#fff',
  },
  videoContainer: {
    width: SCREEN_WIDTH,
    height: 0.6 * SCREEN_HEIGHT,
    backgroundColor: 'rgba(255,255,255,0.1)',
    zIndex: 0,
  },
  video: {
    height: '100%',
    width: '100%',
  },
  durationWindowAndFramesLineContainer: {
    top: -DURATION_WINDOW_BORDER_WIDTH,
    width: SCREEN_WIDTH,
    height: TILE_HEIGHT + DURATION_WINDOW_BORDER_WIDTH * 2,
    justifyContent: 'center',
    zIndex: 10,
  },
  durationWindow: {
    width: DURATION_WINDOW_WIDTH,
    borderColor: 'yellow',
    borderWidth: DURATION_WINDOW_BORDER_WIDTH,
    borderRadius: 4,
    height: TILE_HEIGHT + DURATION_WINDOW_BORDER_WIDTH * 2,
    alignSelf: 'center',
  },
  durationLabelContainer: {
    backgroundColor: 'yellow',
    alignSelf: 'center',
    top: -28,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  durationLabel: {
    color: 'rgba(0,0,0,0.6)',
    fontWeight: '700',
  },
  popLineContainer: {
    position: 'absolute',
    alignSelf: POPLINE_POSITION === '50%' && 'center',
    zIndex: 25,
  },
  popLine: {
    width: 3,
    height: TILE_HEIGHT,
    backgroundColor: 'yellow',
  },
  durationWindowLeftBorder: {
    position: 'absolute',
    width: DURATION_WINDOW_BORDER_WIDTH,
    alignSelf: 'center',
    height: TILE_HEIGHT + DURATION_WINDOW_BORDER_WIDTH * 2,
    left: SCREEN_WIDTH / 2 - DURATION_WINDOW_WIDTH / 2,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    backgroundColor: 'yellow',
    zIndex: 25,
  },
  durationWindowRightBorder: {
    position: 'absolute',
    width: DURATION_WINDOW_BORDER_WIDTH,
    right: SCREEN_WIDTH - SCREEN_WIDTH / 2 - DURATION_WINDOW_WIDTH / 2,
    height: TILE_HEIGHT + DURATION_WINDOW_BORDER_WIDTH * 2,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    backgroundColor: 'yellow',
    zIndex: 25,
  },
  framesLine: {
    width: SCREEN_WIDTH,
    position: 'absolute',
  },
  loadingFrame: {
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderColor: 'rgba(0,0,0,0.1)',
    borderWidth: 1,
  },
  prependFrame: {
    width: SCREEN_WIDTH / 2 - DURATION_WINDOW_WIDTH / 2,
  },
  appendFrame: {
    width: SCREEN_WIDTH / 2 - DURATION_WINDOW_WIDTH / 2,
  },
});

export default App;
