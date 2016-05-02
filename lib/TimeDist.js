const strava = require('strava-v3');

module.exports = {
  calculate(segmentId, callback) {
    strava.segments.get({id: segmentId}, (err, segment) => {
      if (!err) {
        callback(false, {
          segment: segment
        });
      } else {
        console.error(err);
      }
    });
  },

  output(segmentTimeDist) {
    const segment = segmentTimeDist.segment;
    console.log(`segment: ${segment.name} (${segment.city}, ${segment.state})`);
  },

  timeDist(segmentId) {
    this.calculate(segmentId, (err, segmentTimeDist) => {
      if (!err) {
        this.output(segmentTimeDist);
      }
    });
  }
};
