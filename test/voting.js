const Voting = artifacts.require('Voting');

contract('Voting', accounts => {
  describe('newElection', async () => {
    before(async () => {
      instance = await Voting.deployed();
      originalBlock = await web3.eth.getBlock('latest');
      registrationDeadline = 60, votingDeadline = 120, endingTime = 240
      await instance.newElection("test", registrationDeadline, votingDeadline, endingTime, { from: accounts[0] });
    });

    it('creates an election', async () => {
      const election = await instance.elections(0);
      assert.exists(election.name);
    });

    it('sets registrationDeadline relative to current block timestamp', async () => {
      const election = await instance.elections(0);
      assert.strictEqual(election.registrationDeadline.toNumber(), originalBlock.timestamp + registrationDeadline);
    });

    it('sets votingDeadline relative to current block timestamp', async () => {
      const election = await instance.elections(0);
      assert.strictEqual(election.votingDeadline.toNumber(), originalBlock.timestamp + votingDeadline);
    });

    it('sets endingTime relative to current block timestamp', async () => {
      const election = await instance.elections(0);
      assert.strictEqual(election.endingTime.toNumber(), originalBlock.timestamp + endingTime);
    });
  })
});
