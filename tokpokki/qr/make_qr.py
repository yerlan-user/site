import segno, sys, math
url = sys.argv[1]; out = sys.argv[2]
q = segno.make(url, error='h', boost_error=False)
m = [list(r) for r in q.matrix]; n = len(m)
S = 20  # module px
quiet = 2
W = (n + quiet*2) * S
cx = W/2
def finder(r,c): return (r<7 and c<7) or (r<7 and c>=n-7) or (r>=n-7 and c<7)
# logo hole in center
hole = int(n*0.22)//2*2+1
h0 = (n-hole)//2
def inhole(r,c): return h0-1 <= r < h0+hole+1 and h0-1 <= c < h0+hole+1
d=[]
rad = S*0.5
for r in range(n):
    for c in range(n):
        if not m[r][c] or finder(r,c) or inhole(r,c): continue
        x=(c+quiet)*S; y=(r+quiet)*S
        d.append(f'<circle cx="{x+S/2}" cy="{y+S/2}" r="{S*0.46}"/>')
def eye(r0,c0):
    x=(c0+quiet)*S; y=(r0+quiet)*S
    return (f'<rect x="{x+S/2}" y="{y+S/2}" width="{6*S}" height="{6*S}" rx="{S*2}" fill="none" stroke="url(#g)" stroke-width="{S}"/>'
            f'<rect x="{x+2*S}" y="{y+2*S}" width="{3*S}" height="{3*S}" rx="{S*1.1}" fill="#3B2418"/>')
eyes = eye(0,0)+eye(0,n-7)+eye(n-7,0)
lx=(h0+quiet)*S; ls=hole*S
svg=f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {W}" width="{W}" height="{W}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F2683F"/><stop offset="1" stop-color="#C93F1B"/></linearGradient></defs>
<rect width="{W}" height="{W}" rx="{S*2}" fill="#fff"/>
<g fill="url(#g)">{''.join(d)}</g>
{eyes}
<g transform="translate({lx},{lx})">
<rect width="{ls}" height="{ls}" rx="{ls*0.28}" fill="#E8532B"/>
<text x="{ls/2}" y="{ls*0.66}" font-size="{ls*0.5}" text-anchor="middle">🍜</text></g>
</svg>'''
open(out,'w').write(svg); print(n, 'modules')
