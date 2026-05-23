import Cube from 'cubejs';

let solverReady = false;
let solverInitPromise = null;

export const initSolver = () => {
  if (solverInitPromise) return solverInitPromise;
  solverInitPromise = new Promise((resolve) => {
    Cube.initSolver();
    solverReady = true;
    resolve();
  });
  return solverInitPromise;
};

const FACE_CHARS = ['U', 'R', 'F', 'D', 'L', 'B'];

const rotateVec = ([nx, ny, nz], [qx, qy, qz, qw]) => {
  const ix =  qw*nx + qy*nz - qz*ny;
  const iy =  qw*ny + qz*nx - qx*nz;
  const iz =  qw*nz + qx*ny - qy*nx;
  const iw = -qx*nx - qy*ny - qz*nz;
  return [
    ix*qw + iw*(-qx) + iy*(-qz) - iz*(-qy),
    iy*qw + iw*(-qy) + iz*(-qx) - ix*(-qz),
    iz*qw + iw*(-qz) + ix*(-qy) - iy*(-qx),
  ];
};

const normalToFaceIndex = ([x, y, z]) => {
  const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
  const th = 0.7;
  if (ax > th) return x > 0 ? 1 : 4;  // R | L
  if (ay > th) return y > 0 ? 0 : 3;  // U | D
  if (az > th) return z > 0 ? 2 : 5;  // F | B
  return -1;
};

const posToFaceIdx = (face, x, y, z) => {
  switch (face) {
    case 0: return (z + 1) * 3 + (x + 1); // U
    case 1: return (1 - y) * 3 + (1 - z); // R
    case 2: return (1 - y) * 3 + (x + 1); // F
    case 3: return (1 - z) * 3 + (x + 1); // D
    case 4: return (1 - y) * 3 + (z + 1); // L
    case 5: return (1 - y) * 3 + (1 - x); // B
    default: return -1;
  }
};

const CUBE_NORMALS = [
  { normal: [ 1, 0, 0], initCheck: (ix) => ix > 0, colorFace: 1 },  // +x → R
  { normal: [-1, 0, 0], initCheck: (ix) => ix < 0, colorFace: 4 },  // -x → L
  { normal: [ 0, 1, 0], initCheck: (iy) => iy > 0, colorFace: 0 },  // +y → U
  { normal: [ 0,-1, 0], initCheck: (iy) => iy < 0, colorFace: 3 },  // -y → D
  { normal: [ 0, 0, 1], initCheck: (iz) => iz > 0, colorFace: 2 },  // +z → F
  { normal: [ 0, 0,-1], initCheck: (iz) => iz < 0, colorFace: 5 },  // -z → B
];

export const cubiesToString = (cubies) => {
  const state = new Array(54).fill(null);

  cubies.forEach(cubie => {
    const pos  = cubie.position.map(v => Math.round(v / 0.53));
    const init = cubie.initialPosition.map(v => Math.round(v / 0.53));
    const [x, y, z]    = pos;
    const [ix, iy, iz] = init;
    const q = cubie.quaternion; // [qx, qy, qz, qw]

    CUBE_NORMALS.forEach(({ normal, initCheck, colorFace }, faceLocalIdx) => {
      const initVal = [ix, iy, iz][Math.floor(faceLocalIdx / 2)];
      if (!initCheck(initVal)) return;

      const rotated = rotateVec(normal, q);
      const targetFace = normalToFaceIndex(rotated);
      if (targetFace === -1) return;

      const idx = posToFaceIdx(targetFace, x, y, z);
      if (idx < 0 || idx > 8) return;

      const globalIdx = targetFace * 9 + idx;
      state[globalIdx] = FACE_CHARS[colorFace];
    });
  });

  for (let i = 0; i < 54; i++) {
    if (state[i] === null) state[i] = FACE_CHARS[Math.floor(i / 9)];
  }

  return state.join('');
};

export const solveCube = async (cubies) => {
  if (!solverReady) await initSolver();

  const cubeString = cubiesToString(cubies);
  const cube = Cube.fromString(cubeString);

  if (cube.isSolved()) return [];

  const solutionStr = cube.solve(); // ej: "R U' F2 D R2 L2"
  return solutionStr.trim().split(' ').filter(Boolean);
};