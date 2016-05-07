"use strict";

const async = require('async');
const gnuplot = require('gnuplot');
const process = require('process');
const strava = require('strava-v3');

const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getLocalDateString(date) {
  const year = date.getFullYear();
  const paddedYear = year.toString();
  const month = date.getMonth() + 1;
  const paddedMonth = month > 9 ? month.toString() : `0${month}`;
  const day = date.getDate();
  const paddedDay = date > 9 ? day.toString() : `0${day}`;

  return `${paddedYear}-${paddedMonth}-${paddedDay}`;
}

function fetchSegmentEfforts(segmentId, startDate, endDate, callback) {
  const startIso = getLocalDateString(startDate) + 'T00:00:00Z';
  const endIso = getLocalDateString(endDate) + 'T23:59:59Z';
  const pageSize = 200;
  const maxPage = 20;
  let currentPage = 1;
  let allEfforts = [];

  console.log(`fetching efforts for ${startIso} - ${endIso}`);

  const fetchCallback = (err, effortsPage) => {
    allEfforts = allEfforts.concat(effortsPage);
    currentPage += 1;
    const noMorePages = allEfforts.length < ((currentPage - 1) * pageSize);
    const maxPageReached = currentPage > maxPage;
    if (err || maxPageReached || noMorePages) {
      if (maxPageReached) {
        console.log('maximum pages loaded');
      }

      callback(err, allEfforts);
    } else {
      fetchEffortsPage();
    }
  };

  const fetchEffortsPage = () => {
    strava.segments.listEfforts({
      id: segmentId,
      start_date_local: startIso,
      end_date_local: endIso,
      page: currentPage,
      per_page: pageSize
    }, fetchCallback);
  };

  fetchEffortsPage();
}

function binEffortsByHour(efforts) {
  return efforts.reduce((acc, effort) => {
    const startDate = new Date(effort['start_date_local']);
    const hourOfWeek = (startDate.getUTCDay() * 24) + startDate.getUTCHours();

    if (acc.hasOwnProperty(hourOfWeek)) {
      acc[hourOfWeek] += 1;
    } else {
      acc[hourOfWeek] = 0;
    }

    return acc;
  }, []);
}

function plotDay(dayName, dayIndex, data) {
  const dayStart = dayIndex * 24;
  const dayEnd = dayStart + 24;
  const dayData = data.slice(dayStart, dayEnd);

  const dataString = dayData.reduce((acc, count, dayHour) => {
    const label = dayHour === 12 ? 'N' : dayHour % 12
    return acc + `${dayHour}\t${count || 0}\t${label}\n`;
  }, '');

  if (dataString.length) {
    const gnuData = `${dataString}e\n`;

    const totalCount = dayData.reduce((acc, count) => {
      return acc + (count || 0);
    }, 0);

    gnuplot()
      .set('term dumb size 100, 30')
      .set(`title "${dayName}"`)
      .set('xrange [0:24]')
      .set('boxwidth 1')
      .set('style fill solid')
      .plot(`'-' using 1:2:xtic(3) title "${totalCount} efforts" with boxes\n${gnuData}`, {end: true})
      .pipe(process.stdout);
  } else {
    console.log(`No data available for ${dayName}`);
  }
}

function output(segment, efforts) {
  const binnedEfforts = binEffortsByHour(efforts);

  console.log(`${efforts.length} efforts loaded`);
  console.log(`${segment.name} (${segment.city}, ${segment.state})`);

  days.forEach((dayName, dayIndex) => {
    plotDay(dayName, dayIndex, binnedEfforts);
  });
}

module.exports = (segmentId) => {
  async.parallel([
    (callback) => {
      strava.segments.get({id: segmentId}, callback);
    },
    (callback) => {
      const now = new Date().getTime();
      const oneMonthAgo = now - (1000 * 60 * 60 * 24 * 31);

      fetchSegmentEfforts(segmentId, new Date(oneMonthAgo), new Date(now), callback);
    }
  ], (err, results) => {
    if (err) {
      console.error(err);
    } else {
      output(results[0], results[1]);
    }
  });
};
