import { ALL, DAY, WEEK, MONTH, getReferencePoint } from '../docs/main.js';

describe('stockview', () => {
    function fmtDate(msDate) {
        return new Date(msDate).toLocaleString();
    }

    describe('getReferencePoint', () => {
        const dateStrings = [
            '1/1/2000',
            '1/2/2000',
            '1/20/2000',
            '1/21/2000',
            '2/22/2000',
            '2/28/2000',
            '3/13/2000',
            '3/14/2000',
            '3/15/2000',
            '3/19/2000',
            '3/20/2000',
            '3/20/2000 23:59:59',
            '3/21/2000',
            '3/21/2000 0:00:01',
            '3/21/2000 0:01:00',
            '3/21/2000 1:00:00',
            '3/21/2000 14:00:01'
        ]
        const descendingHistory = dateStrings.map(x => [new Date(x).valueOf()]).reverse();

        it('gives oldest point when howFarBack is ALL', () => {
            const referencePoint = getReferencePoint(descendingHistory, ALL);
            expect(fmtDate(referencePoint[0])).toEqual(fmtDate(dateStrings[0]));
        });

        it('gives most recent point not from latest day when howFarBack is DAY', () => {
            const referencePoint = getReferencePoint(descendingHistory, DAY);
            expect(fmtDate(referencePoint[0])).toEqual(fmtDate('3/20/2000 23:59:59'));
        });

        it('gives most recent point not from the latest 7 days when howFarBack is WEEK', () => {
            const referencePoint = getReferencePoint(descendingHistory, WEEK);
            expect(fmtDate(referencePoint[0])).toEqual(fmtDate('3/14/2000'));
        });
    });
});